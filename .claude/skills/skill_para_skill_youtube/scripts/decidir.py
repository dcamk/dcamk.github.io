"""Uso: python scripts/decidir.py "<decisão>"
Formatos aceitos (combináveis com ;):
  adicionar 1,2,5-9        descartar 3,4        adicionar alta        adicionar alta,media        adicionar tudo
Itens não citados ficam descartados. Grava trabalho/aprovados.json e trabalho/descartados.json."""
import json
import re
import sys
from pathlib import Path

PASTA = Path("trabalho")
NIVEIS = {"alta": 3, "media": 2, "média": 2, "baixa": 1, "nenhuma": 0}


def numeros(txt):
    out = set()
    for p in re.findall(r"\d+(?:-\d+)?", txt):
        a, _, b = p.partition("-")
        out.update(range(int(a), int(b or a) + 1))
    return out


def main():
    itens = json.loads((PASTA / "revisao.json").read_text(encoding="utf-8"))
    aprovados, descartados = set(), set()
    for parte in " ".join(sys.argv[1:]).lower().split(";"):
        parte = parte.strip()
        alvo = aprovados if parte.startswith(("adicionar", "add", "manter")) else descartados
        if "tudo" in parte or "todos" in parte:
            alvo.update(i["n"] for i in itens)
        for nome, v in NIVEIS.items():
            if re.search(rf"\b{nome}\b", parte):
                alvo.update(i["n"] for i in itens if i.get("relevancia", 0) == v)
        alvo.update(numeros(parte))
    aprovados -= descartados
    (PASTA / "aprovados.json").write_text(
        json.dumps([i for i in itens if i["n"] in aprovados], ensure_ascii=False, indent=1), encoding="utf-8")
    (PASTA / "descartados.json").write_text(
        json.dumps([i for i in itens if i["n"] not in aprovados], ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"aprovados": sorted(aprovados), "descartados": len(itens) - len(aprovados)}))


if __name__ == "__main__":
    main()
