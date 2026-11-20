// Tests écrits avec l'aide d'une IA (Claude), relus et validés par Arnaud.
import {
  Controller,
  Get,
  INestApplication,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { LoggingInterceptor } from './../src/common/logging.interceptor';

// Contrôleur qui n'existe que pour ce test : il simule un succès,
// une erreur métier (404) et un bug inattendu (500), sans toucher à l'application.
@Controller('test')
class TestController {
  @Get('ok')
  ok(): string {
    return 'ok';
  }

  @Get('not-found')
  notFound(): string {
    throw new NotFoundException('Playlist introuvable');
  }

  @Get('crash')
  crash(): string {
    throw new Error('Bug simulé');
  }
}

const ALL_HEADERS = {
  'X-Platform': 'android',
  'X-Device': 'Pixel 8',
  'X-App-Version': '1.0.0',
};

// On remplace les méthodes du Logger par des « espions » : ils enregistrent
// chaque appel (et n'affichent rien), ce qui permet de vérifier les messages.
function spyOnLogger() {
  return {
    log: jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
    warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}),
  };
}

// Nest utilise aussi Logger pour ses propres messages (démarrage, ExceptionsHandler...).
// On ne garde que les messages écrits par une instance nommée « LoggingInterceptor ».
function messagesOf(spy: jest.SpyInstance): string[] {
  return spy.mock.calls
    .filter(
      (_call, i) =>
        (spy.mock.contexts[i] as { context?: string }).context ===
        LoggingInterceptor.name,
    )
    .map((call: unknown[]) => String(call[0]));
}

describe('LoggingInterceptor (e2e)', () => {
  let app: INestApplication<App>;
  let spies: ReturnType<typeof spyOnLogger>;

  beforeEach(async () => {
    spies = spyOnLogger();

    // Mini-application de test : le contrôleur de test + l'intercepteur global,
    // déclaré exactement comme dans AppModule.
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
      providers: [{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('journalise un succès en LOG avec méthode, URL, statut, durée et en-têtes', async () => {
    await request(app.getHttpServer())
      .get('/test/ok')
      .set(ALL_HEADERS)
      .expect(200);

    const logs = messagesOf(spies.log);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('GET /test/ok 200');
    expect(logs[0]).toMatch(/ - \d+ms - /);
    expect(logs[0]).toContain(
      '{"x-platform":"android","x-device":"Pixel 8","x-app-version":"1.0.0"}',
    );
    expect(logs[0]).not.toContain('missing');
    expect(messagesOf(spies.warn)).toHaveLength(0);
    expect(messagesOf(spies.error)).toHaveLength(0);
  });

  it('passe en WARN et liste les trois en-têtes quand aucun n’est envoyé', async () => {
    await request(app.getHttpServer()).get('/test/ok').expect(200);

    const warns = messagesOf(spies.warn);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('GET /test/ok 200');
    expect(warns[0]).toContain(
      '{"x-platform":null,"x-device":null,"x-app-version":null}',
    );
    expect(warns[0]).toContain('missing: x-platform, x-device, x-app-version');
    expect(messagesOf(spies.log)).toHaveLength(0);
  });

  it('ne liste que les en-têtes réellement manquants', async () => {
    await request(app.getHttpServer())
      .get('/test/ok')
      .set('X-Platform', 'ios')
      .expect(200);

    const warns = messagesOf(spies.warn);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('"x-platform":"ios"');
    expect(warns[0]).toContain('missing: x-device, x-app-version');
  });

  it('ignore la casse des noms d’en-têtes', async () => {
    await request(app.getHttpServer())
      .get('/test/ok')
      .set({
        'x-platform': 'android',
        'x-device': 'Pixel 8',
        'x-app-version': '1.0.0',
      })
      .expect(200);

    expect(messagesOf(spies.log)).toHaveLength(1);
    expect(messagesOf(spies.warn)).toHaveLength(0);
  });

  it('traite un en-tête envoyé vide comme manquant', async () => {
    await request(app.getHttpServer())
      .get('/test/ok')
      .set({ ...ALL_HEADERS, 'X-Device': '' })
      .expect(200);

    const warns = messagesOf(spies.warn);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('"x-device":null');
    expect(warns[0]).toContain('missing: x-device');
  });

  it('journalise une HttpException en WARN avec son vrai code et son message', async () => {
    await request(app.getHttpServer())
      .get('/test/not-found')
      .set(ALL_HEADERS)
      .expect(404);

    const warns = messagesOf(spies.warn);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('GET /test/not-found 404');
    expect(warns[0]).toContain('error: Playlist introuvable');
    expect(messagesOf(spies.error)).toHaveLength(0);
  });

  it('journalise une erreur inattendue en ERROR avec le code 500', async () => {
    await request(app.getHttpServer())
      .get('/test/crash')
      .set(ALL_HEADERS)
      .expect(500);

    const errors = messagesOf(spies.error);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('GET /test/crash 500');
    expect(errors[0]).toContain('error: Bug simulé');
  });

  // Limite connue : sans contrôleur, l'intercepteur ne s'exécute pas.
  // À traiter avec l'authentification (requêtes rejetées par les guards).
  // Quand ce sera fait, ce test devra être inversé.
  it('ne journalise pas une route inexistante (limite connue)', async () => {
    await request(app.getHttpServer())
      .get('/nexiste-pas')
      .set(ALL_HEADERS)
      .expect(404);

    expect(messagesOf(spies.log)).toHaveLength(0);
    expect(messagesOf(spies.warn)).toHaveLength(0);
    expect(messagesOf(spies.error)).toHaveLength(0);
  });
});

describe('AppModule', () => {
  it('active LoggingInterceptor sur toute l’application', async () => {
    const spies = spyOnLogger();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();

    await request(app.getHttpServer()).get('/').set(ALL_HEADERS).expect(200);

    expect(messagesOf(spies.log)).toEqual([
      expect.stringContaining('GET / 200'),
    ]);

    await app.close();
    jest.restoreAllMocks();
  });
});
