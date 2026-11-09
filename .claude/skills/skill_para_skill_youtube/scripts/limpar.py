"""Uso: python scripts/limpar.py trabalho/<id>.transcricao.json trabalho/<id>.video.json
Gera trabalho/<id>.limpo.txt (texto sem propaganda, em blocos de 30 s) e trabalho/<id>.filtro.json."""
import json
import re
import sys
from pathlib import Path

VENDA_FORTE = [
    r"link na descri[cç][aã]o", r"cupom", r"c[oó]digo (de desconto|promocional)", r"use o c[oó]digo",
    r"\d+\s*% de desconto", r"(esse|este) v[ií]deo (é|foi) patrocinado", r"patroc[ií]ni", r"\bpubli(cidade)?\b",
    r"parceiro do canal", r"compre (j[aá]|agora|no site|pelo link)", r"frete gr[aá]tis", r"garanta (j[aá]|o seu)",
    r"[uú]ltimas vagas", r"inscri[cç][oõ]es abertas", r"meu curso", r"minha mentoria", r"chama no (whats|direct)",
    r"(acesse|entra) no site", r"oferta (especial|exclusiva|por tempo)", r"black friday", r"lote promocional",
]
ENGAJAMENTO = [
    r"inscreva-se", r"se inscreve", r"ativ[ae] o sininho", r"deixa (o )?(seu )?like", r"compartilh[ae] (esse|com)",
    r"comenta a[ií] embaixo", r"seja membro", r"me segue no",
]
VENDA_FRACA = [r"\bpre[cç]o\b", r"\bR\$\s*\d", r"\bmarca\b", r"\bloja\b", r"\bproduto\b", r"\bpromo[cç][aã]o\b", r"\bparcel"]
CAPITULO_PROPAGANDA = re.compile(r"publi|patroc|sponsor|oferta|cupom|desconto|an[uú]ncio|parceiro|merch", re.I)
DESCRICAO_COMERCIAL = [r"#publi", r"#ad\b", r"publicidade", r"conte[uú]do patrocinado", r"em parceria com",
                       r"parceria paga", r"compre (aqui|agora)", r"link de afiliado"]

FORTE = re.compile("|".join(VENDA_FORTE), re.I)
ENGAJ = re.compile("|".join(ENGAJAMENTO), re.I)
FRACA = re.compile("|".join(VENDA_FRACA), re.I)
MULETAS = re.compile(
    r"\b(n[eé]\b\??|tipo assim|ent[aã]o assim|beleza\?|t[aá]\?|galera|pessoal|ahn?|ehh?|hum+|cara,)\b[,]?\s*", re.I)


def mmss(s):
    s = int(s)
    return f"{s // 60}:{s % 60:02d}"


def blocos(segs, janela=30):
    out, atual, ini = [], [], None
    for s in segs:
        if ini is not None and s["t"] - ini >= janela:
            out.append({"ini": ini, "fim": s["t"], "txt": " ".join(atual)})
            atual, ini = [], None
        if ini is None:
            ini = s["t"]
        atual.append(s["txt"].replace("\n", " "))
    if atual:
        out.append({"ini": ini, "fim": segs[-1]["t"] + 5, "txt": " ".join(atual)})
    return out


def limpar(txt):
    txt = re.sub(r"\[(m[uú]sica|music|aplausos|risos|applause|laughter)\]", " ", txt, flags=re.I)
    txt = MULETAS.sub("", txt)
    txt = re.sub(r"\b(\w+)( \1\b)+", r"\1", txt, flags=re.I)
    return re.sub(r"\s+", " ", txt).strip()


def faixas_capitulos(capitulos, fim_video):
    caps = sorted(capitulos or [], key=lambda c: c["t"])
    faixas = []
    for i, c in enumerate(caps):
        if CAPITULO_PROPAGANDA.search(c.get("titulo", "")):
            fim = caps[i + 1]["t"] if i + 1 < len(caps) else fim_video
            faixas.append((c["t"], fim))
    return faixas


def rotular(b, faixas):
    meio = (b["ini"] + b["fim"]) / 2
    if any(a <= meio < z for a, z in faixas):
        return "propaganda"
    t = b["txt"]
    forte, engaj, fraca = len(FORTE.findall(t)), len(ENGAJ.findall(t)), len(FRACA.findall(t))
    if forte >= 2 or (forte >= 1 and fraca >= 2):
        return "propaganda"
    if engaj >= 1 and len(t.split()) < 60:
        return "propaganda"
    if forte == 1 or fraca >= 3:
        return "duvida"
    return "conteudo"


def processar(segs, meta):
    if not segs:
        return "", {"erro": "transcrição vazia"}
    bs = blocos(segs)
    faixas = faixas_capitulos(meta.get("capitulos"), bs[-1]["fim"])
    rotulos = [rotular(b, faixas) for b in bs]
    dur = lambda b: max(b["fim"] - b["ini"], 1)
    total = sum(dur(b) for b in bs)
    frac = sum(dur(b) for b, r in zip(bs, rotulos) if r == "propaganda") / total
    desc = (meta.get("titulo", "") + " " + meta.get("descricao", "")).lower()
    sinais_desc = sum(bool(re.search(p, desc)) for p in DESCRICAO_COMERCIAL)
    comercial = bool(meta.get("promocao_paga")) or sinais_desc >= 2 or frac > 0.35

    linhas = []
    for b, r in zip(bs, rotulos):
        if r == "propaganda":
            continue
        texto = limpar(b["txt"])
        if texto:
            linhas.append(f"[{mmss(b['ini'])}]{' [?]' if r == 'duvida' else ''} {texto}")
    relatorio = {
        "id": meta.get("id"), "titulo": meta.get("titulo"), "canal": meta.get("canal"),
        "duracao_s": int(bs[-1]["fim"]), "blocos": len(bs),
        "propaganda_removida": [f"{mmss(b['ini'])}-{mmss(b['fim'])}" for b, r in zip(bs, rotulos) if r == "propaganda"],
        "blocos_duvida": rotulos.count("duvida"), "fracao_propaganda": round(frac, 2),
        "promocao_paga_declarada": bool(meta.get("promocao_paga")), "video_comercial": comercial,
        "palavras_antes": sum(len(b["txt"].split()) for b in bs),
        "palavras_depois": sum(len(l.split()) for l in linhas),
    }
    return "\n".join(linhas), relatorio


def main():
    arq_t, arq_v = Path(sys.argv[1]), Path(sys.argv[2])
    segs = json.loads(arq_t.read_text(encoding="utf-8"))
    meta = json.loads(arq_v.read_text(encoding="utf-8")) if arq_v.exists() else {}
    texto, rel = processar(segs, meta)
    vid = meta.get("id") or arq_t.name.split(".")[0]
    pasta = arq_t.parent
    (pasta / f"{vid}.limpo.txt").write_text(texto + "\n", encoding="utf-8")
    (pasta / f"{vid}.filtro.json").write_text(json.dumps(rel, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: rel.get(k) for k in
                      ("id", "video_comercial", "fracao_propaganda", "blocos_duvida", "palavras_antes", "palavras_depois")},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
