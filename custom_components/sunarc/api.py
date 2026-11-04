"""Vragen aan SunArc (besluit 184): de kamers voor de zinnen, en een vraag van Assist.

Alles leest alleen. Een opdracht als "koel de zolder naar 21" krijgt als
antwoord wat SunArc zou doen; er gaat niets naar de airco.
"""

from __future__ import annotations

import asyncio
from typing import Any

import aiohttp

from .const import VERSIE


class SunArcFout(Exception):
    """SunArc antwoordt niet, of weigert de sleutel."""


class SunArcApi:
    """Een klein loket naar ``/api/assist`` en ``/api/vraag``, met de sleutel."""

    def __init__(self, sessie: aiohttp.ClientSession, adres: str, sleutel: str) -> None:
        self._sessie = sessie
        self._adres = adres.rstrip("/")
        self._sleutel = sleutel

    @property
    def adres(self) -> str:
        return self._adres

    async def _haal(self, pad: str, vraag: dict[str, str]) -> dict[str, Any]:
        try:
            async with asyncio.timeout(10):
                async with self._sessie.get(f"{self._adres}{pad}", params=vraag, headers={"Authorization": f"Bearer {self._sleutel}"}) as antwoord:
                    if antwoord.status == 401:
                        raise SunArcFout("de sleutel klopt niet")
                    if antwoord.status != 200:
                        raise SunArcFout(f"SunArc gaf {antwoord.status}")
                    return await antwoord.json()
        except (aiohttp.ClientError, TimeoutError) as fout:
            raise SunArcFout(f"SunArc is niet te bereiken: {fout}") from fout

    async def info(self) -> dict[str, Any]:
        """De naam, de versie en de kamers met hun woorden; met onze versie, voor de naam van de intentie."""
        return await self._haal("/api/assist", {"integratie": VERSIE})

    async def vraag(self, soort: str, taal: str, kamer: str | None = None, wens: str | None = None, temperatuur: int | None = None) -> str:
        """Een vraag van Assist; het antwoord om uit te spreken."""
        vraag = {"v": soort, "taal": taal}
        if kamer:
            vraag["kamer"] = kamer
        if wens:
            vraag["wens"] = wens
        if temperatuur is not None:
            vraag["temperatuur"] = str(temperatuur)
        antwoord = await self._haal("/api/vraag", vraag)
        # Het antwoord zoals de app het toont; Assist laat het zien en spreekt het uit.
        return str(antwoord.get("antwoord") or "")
