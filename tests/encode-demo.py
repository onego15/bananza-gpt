"""Encode captured real browser frames; Pillow GIF + FFmpeg MP4."""
from pathlib import Path
import json, subprocess
from PIL import Image
import imageio_ffmpeg

root=Path(__file__).resolve().parent.parent
source=root/'test-output'/'recording'/'gameplay.webm'
metadata=json.loads((source.parent/'recording.json').read_text())
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
common=[ffmpeg,'-hide_banner','-loglevel','error','-y','-ss',str(metadata.get('startOffset',0)),'-i',str(source)]
subprocess.run(common+['-filter_complex','[0:v]fps=10,scale=640:400:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=none','-t','14','-loop','0',str(root/'docs'/'demo.gif')],check=True)
subprocess.run(common+['-vf','fps=30,scale=1280:800','-t','14','-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',str(root/'docs'/'demo.mp4')],check=True)
with Image.open(root/'docs'/'demo.gif') as check:
    total=0
    for n in range(check.n_frames):check.seek(n);total+=check.info.get('duration',0)
    print(json.dumps({'gif_frames':check.n_frames,'gif_duration_ms':total,'size':check.size,'bytes':(root/'docs'/'demo.gif').stat().st_size,'mp4_bytes':(root/'docs'/'demo.mp4').stat().st_size}))
