"""Plano B e C quando o painel de transcrição do YouTube não existe.
Uso:
  python scripts/obter_transcricao.py <id>            legendas (manuais ou automáticas) via yt-dlp
  python scripts/obter_transcricao.py <id> --audio    baixa o áudio e transcreve com Whisper (OPENAI_API_KEY)
Saída: trabalho/<id>.transcricao.json  ->  [{"t": segundos, "txt": "..."}]"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

PASTA = Path("trabalho")
IDIOMAS = "pt-BR,pt,pt-orig,pt.*,en,en-orig"


def url(vid):
    return f"https://www.youtube.com/watch?v={vid}"


def legendas(vid):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ["yt-dlp", "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", IDIOMAS,
             "--sub-format", "json3", "--sleep-requests", "2", "-o", f"{tmp}/%(id)s.%(ext)s", url(vid)],
            check=False, capture_output=True, text=True)
        arquivos = sorted(Path(tmp).glob(f"{vid}*.json3"),
                          key=lambda p: (0 if ".pt" in p.name else 1, 0 if "orig" not in p.name else 1))
        if not arquivos:
            return None
        dados = json.loads(arquivos[0].read_text(encoding="utf-8"))
    segs = []
    for ev in dados.get("events", []):
        txt = "".join(s.get("utf8", "") for s in ev.get("segs", []) or []).replace("\n", " ").strip()
        if txt:
            segs.append({"t": round(ev.get("tStartMs", 0) / 1000, 1), "txt": txt})
    return segs or None


def audio_whisper(vid):
    import requests
    chave = os.environ["OPENAI_API_KEY"]
    with tempfile.TemporaryDirectory() as tmp:
        bruto = f"{tmp}/a.%(ext)s"
        subprocess.run(["yt-dlp", "-f", "bestaudio", "--sleep-requests", "2", "-o", bruto, url(vid)], check=True,
                       capture_output=True)
        origem = next(Path(tmp).glob("a.*"))
        subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(origem), "-ac", "1", "-ar", "16000", "-b:a", "32k",
                        "-f", "segment", "-segment_time", "1200", f"{tmp}/p%03d.mp3"], check=True)
        segs = []
        for i, parte in enumerate(sorted(Path(tmp).glob("p*.mp3"))):
            with open(parte, "rb") as f:
                r = requests.post("https://api.openai.com/v1/audio/transcriptions",
                                  headers={"Authorization": f"Bearer {chave}"},
                                  data={"model": "whisper-1", "response_format": "verbose_json", "language": "pt"},
                                  files={"file": (parte.name, f, "audio/mpeg")}, timeout=600)
            r.raise_for_status()
            for s in r.json().get("segments", []):
                segs.append({"t": round(i * 1200 + s["start"], 1), "txt": s["text"].strip()})
    return segs


def main():
    vid = sys.argv[1]
    PASTA.mkdir(exist_ok=True)
    segs = audio_whisper(vid) if "--audio" in sys.argv else legendas(vid)
    if not segs:
        print(json.dumps({"id": vid, "ok": False, "proximo": "--audio"}))
        sys.exit(1)
    (PASTA / f"{vid}.transcricao.json").write_text(json.dumps(segs, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"id": vid, "ok": True, "segmentos": len(segs)}))


if __name__ == "__main__":
    main()
