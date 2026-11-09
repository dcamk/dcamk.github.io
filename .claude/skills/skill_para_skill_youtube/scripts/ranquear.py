"""Uso: python scripts/ranquear.py
Lê trabalho/*.itens.json, funde itens repetidos entre vídeos, ordena e grava
trabalho/revisao.md (para mostrar ao usuário) e trabalho/revisao.json (para aplicar a decisão)."""
import json
import re
import unicodedata
from pathlib import Path

PASTA = Path("trabalho")
PESO_TIPO = {"passo": 3, "numero": 3, "erro": 2, "cuidado": 2, "ferramenta": 2, "fato": 1, "conceito": 1}


def chave(txt):
    t = unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode().lower()
    return " ".join(sorted(set(re.findall(r"[a-z0-9]{4,}", t))))


def parecidos(a, b):
    sa, sb = set(a.split()), set(b.split())
    return bool(sa and sb) and len(sa & sb) / len(sa | sb) >= 0.6


def mmss(s):
    s = int(s or 0)
    return f"{s // 60}:{s % 60:02d}"


def main():
    grupos = []
    for arq in sorted(PASTA.glob("*.itens.json")):
        vid = arq.name.split(".")[0]
        for it in json.loads(arq.read_text(encoding="utf-8")):
            it["fontes"] = [f"{vid}@{mmss(it.get('t'))}"]
            k = chave(it["texto"])
            alvo = next((g for g in grupos if parecidos(g["_k"], k)), None)
            if alvo:
                alvo["fontes"] += it["fontes"]
                if it.get("relevancia", 0) > alvo.get("relevancia", 0):
                    alvo.update({x: it[x] for x in ("relevancia", "projeto", "motivo") if x in it})
                if len(it["texto"]) > len(alvo["texto"]):
                    alvo["texto"] = it["texto"]
            else:
                it["_k"] = k
                grupos.append(it)

    for g in grupos:
        g["pontos"] = g.get("relevancia", 0) * 10 + (len(g["fontes"]) - 1) * 4 + PESO_TIPO.get(g.get("tipo"), 0)
    grupos.sort(key=lambda g: -g["pontos"])
    for n, g in enumerate(grupos, 1):
        g["n"] = n
        g.pop("_k", None)

    nivel = {3: "alta", 2: "média", 1: "baixa", 0: "nenhuma"}
    linhas = ["| # | relevância | projeto | tipo | item | fontes | motivo |", "|---|---|---|---|---|---|---|"]
    for g in grupos:
        linhas.append(f"| {g['n']} | {nivel.get(g.get('relevancia', 0))} | {g.get('projeto', '-')} | {g.get('tipo', '')} | "
                      f"{g['texto']} | {len(g['fontes'])} ({', '.join(g['fontes'][:3])}) | {g.get('motivo', '')} |")
    (PASTA / "revisao.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")
    (PASTA / "revisao.json").write_text(json.dumps(grupos, ensure_ascii=False, indent=1), encoding="utf-8")
    contagem = {v: sum(1 for g in grupos if g.get("relevancia", 0) == k) for k, v in nivel.items()}
    print(json.dumps({"itens": len(grupos), **contagem}, ensure_ascii=False))


if __name__ == "__main__":
    main()
