"""Vaste waarden van de integratie SunArc (besluit 184)."""

DOMAIN = "sunarc"
#: De versie uit manifest.json; een test houdt ze gelijk. SunArc kiest er de naam van de intentie mee.
VERSIE = "2.0.1"

#: Het adres van SunArc, zoals ``http://abcd1234-hems-climate:8099``.
CONF_ADRES = "adres"
#: De sleutel voor de vragen (Instellingen › Bewoners en toegang › Sleutel voor de assistent).
CONF_SLEUTEL = "sleutel"

#: Zo vaak kijkt de integratie of de kamers veranderden, voor de zinnen.
KAMERS_ELKE_MINUTEN = 30

#: Wat Assist zegt als SunArc niet antwoordt.
GEEN_ANTWOORD = {"nl": "SunArc geeft nu geen antwoord.", "en": "SunArc is not answering right now."}
