import 'package:flutter/material.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

void main() => runApp(const MusicRoomApp());

class MusicRoomApp extends StatelessWidget {
  const MusicRoomApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Music Room',
      theme: ThemeData(colorSchemeSeed: Colors.deepPurple),
      home: const PlayerPage(videoId: 'dQw4w9WgXcQ'),
    );
  }
}

class PlayerPage extends StatefulWidget {
  const PlayerPage({super.key, required this.videoId});

  final String videoId;

  @override
  State<PlayerPage> createState() => _PlayerPageState();
}

class _PlayerPageState extends State<PlayerPage> {
  late final _controller = YoutubePlayerController.fromVideoId(
    videoId: widget.videoId,
    params: const YoutubePlayerParams(showFullscreenButton: true),
  );

  @override
  void dispose() {
    _controller.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Music Room')),
      body: YoutubePlayer(controller: _controller),
    );
  }
}
