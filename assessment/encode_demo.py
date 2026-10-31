from pathlib import Path
import os
import json
import re
import shutil
import subprocess

root = Path(__file__).resolve().parent
prepared = root.parent.parent / '.runtime/node/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe'
binary = os.environ.get('FFMPEG_BINARY') or shutil.which('ffmpeg') or str(prepared)
if not Path(binary).exists():
    raise SystemExit('Install FFmpeg or set FFMPEG_BINARY before encoding the demonstration.')

header = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 1020
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Bitstream Vera Sans,24,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,60,60,22,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''

def ass_time(value):
    hour, minute, seconds, millis = re.split('[:,]', value)
    return f'{int(hour)}:{minute}:{seconds}.{int(millis)//10:02d}'

events = []
for block in re.split(r'\n\s*\n', (root / 'demo.srt').read_text(encoding='utf-8').strip()):
    lines = block.splitlines()
    start, end = lines[1].split(' --> ')
    text = r'\N'.join(lines[2:])
    events.append(f'Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{text}')
(root / 'demo.ass').write_text(header + '\n'.join(events) + '\n', encoding='utf-8')
raw_probe = subprocess.run([binary, '-i', str(root / 'private/demo-raw.webm')], capture_output=True, text=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
raw_match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', raw_probe.stderr)
if not raw_match:
    raise SystemExit('Cannot verify raw recording duration')
raw_hours, raw_minutes, raw_seconds = map(float, raw_match.groups())
raw_duration = raw_hours * 3600 + raw_minutes * 60 + raw_seconds
manifest_path = root / 'evidence/manual-demo.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
if not manifest.get('passed') or manifest['scenes'][-1]['seconds'] > 165:
    raise SystemExit('Complete the timed walkthrough before encoding')
intended_duration = 185
lead_in = max(0, raw_duration - intended_duration)
subprocess.run([
    binary, '-y', '-ss', str(lead_in), '-i', 'private/demo-raw.webm', '-t', str(intended_duration),
    '-vf', 'pad=iw:ih+120:0:0:color=0x0f172a,ass=demo.ass:fontsdir=../api/app/assets/fonts',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-pix_fmt', 'yuv420p',
    '-r', '20', '-movflags', '+faststart', 'demo.mp4'
], cwd=root, check=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
probe = subprocess.run([binary, '-i', str(root / 'demo.mp4')], capture_output=True, text=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', probe.stderr)
if not match:
    raise SystemExit('Cannot verify encoded video duration')
hours, minutes, seconds = map(float, match.groups())
duration = hours * 3600 + minutes * 60 + seconds
if not 180 <= duration <= 300:
    raise SystemExit(f'Video must be 3-5 minutes, got {duration}')
manifest_path = root / 'evidence/manual-demo.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
if 'duration_seconds' in manifest:
    manifest['run_duration_seconds'] = manifest.pop('duration_seconds')
manifest['raw_video_duration_seconds'] = raw_duration
manifest['trimmed_startup_seconds'] = lead_in
manifest['video_duration_seconds'] = duration
manifest['captions'] = 'Bahasa Indonesia, separate subtitle band'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Encoded video: {duration:.2f} seconds')
print(root / 'demo.mp4')
