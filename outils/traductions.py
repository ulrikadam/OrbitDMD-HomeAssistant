"""Genere strings.json et translations/<langue>.json de l'integration (12 langues, comme le panneau).

Utilisation : py -3.12 outils/traductions.py
Noms des effets et des couleurs : les memes que ceux du panneau (dmd/hapayload.cpp).
"""
import json
import os

D = os.path.join(os.path.dirname(__file__), "..", "custom_components", "orbitdmd")
EFFECTS = ["defile", "inverse", "monte", "descend", "lettres", "pluie", "fondu"]
COLORS = ["blanc", "rouge", "orange", "ambre", "jaune", "vert", "turquoise", "bleu", "violet", "rose", "arc-en-ciel"]
SCREENS = ["gif", "heure", "date", "meteo", "message", "texte", "compte", "demarrage", "mire"]
FIELDS = ["device_id", "message", "gif", "effect", "color", "speed", "passes", "font", "size", "blink"]

# Chaque langue : textes simples, puis listes dans l'ordre de SCREENS / FIELDS (nom, aide) / EFFECTS / COLORS.
T = {
 "fr": dict(
  title="Relier un panneau OrbitDMD", desc="Adresse du panneau (comme dans votre navigateur, par exemple orbitdmd.local ou 192.168.1.50) et mot de passe de sa page web.",
  host="Adresse du panneau", password="Mot de passe de la page web", reauth="Le panneau refuse le mot de passe : indiquez le mot de passe actuel de sa page web.",
  found="Panneau OrbitDMD trouvé", found_desc="Le panneau « {name} » a été trouvé sur le réseau ({host}). Indiquez le mot de passe de sa page web pour le relier.",
  cannot="Panneau injoignable : vérifiez l'adresse et qu'il est allumé.", auth="Mot de passe incorrect.", already="Ce panneau est déjà relié.",
  reauth_ok="Mot de passe mis à jour.", not_orbitdmd="Cet appareil n'est pas un panneau OrbitDMD.",
  pause="Pause", hourly="Luminosité heure par heure", clock="Afficher l'heure", weather="Afficher la météo", restart="Redémarrer",
  gif="GIF affichée", screen="Écran", temp="Température du processeur", ip="Adresse IP", version="Version", message="Message",
  svc="Afficher une notification", svc_desc="Affiche tout de suite un texte et/ou une GIF sur le panneau, par-dessus les GIF.",
  screens=["GIF", "Heure", "Date", "Météo", "Message", "Texte", "Compte à rebours", "Démarrage", "Mire de test"],
  fields=[("Panneau", "Panneaux à utiliser (tous si vide)."), ("Texte", "Texte qui défile (200 octets au plus)."),
          ("GIF", "GIF jouée avant le texte : Categorie/nom.gif"), ("Effet", "Arrivée du texte."), ("Couleur", "Nom de couleur ou RRGGBB."),
          ("Vitesse", "1 (lent) à 10 (rapide)."), ("Passages", "Nombre de passages de la GIF et du texte (1 à 10)."),
          ("Police", "Pixel ou un fichier de police du panneau."), ("Taille", "Taille en pixels, 0 = automatique."),
          ("Clignote", "Texte clignotant (alerte prioritaire).")],
  effects=["Défile à gauche", "Défile à droite", "Monte", "Descend", "Lettre par lettre", "Pluie de lettres", "Fondu"],
  colors=["Blanc", "Rouge", "Orange", "Ambre", "Jaune", "Vert", "Turquoise", "Bleu", "Violet", "Rose", "Arc-en-ciel"]),
 "en": dict(
  title="Connect an OrbitDMD panel", desc="Address of the panel (as in your browser, e.g. orbitdmd.local or 192.168.1.50) and the password of its web page.",
  host="Panel address", password="Web page password", reauth="The panel refused the password: enter the current password of its web page.",
  found="OrbitDMD panel found", found_desc="The panel “{name}” was found on the network ({host}). Enter the password of its web page to connect it.",
  cannot="Panel unreachable: check the address and that it is switched on.", auth="Wrong password.", already="This panel is already set up.",
  reauth_ok="Password updated.", not_orbitdmd="This device is not an OrbitDMD panel.",
  pause="Pause", hourly="Hourly brightness", clock="Show time", weather="Show weather", restart="Restart",
  gif="Current GIF", screen="Screen", temp="Processor temperature", ip="IP address", version="Version", message="Message",
  svc="Show a notification", svc_desc="Shows a text and/or a GIF on the panel right away, over the GIFs.",
  screens=["GIF", "Time", "Date", "Weather", "Message", "Text", "Countdown", "Start-up", "Test pattern"],
  fields=[("Panel", "Panels to use (all if empty)."), ("Text", "Text to scroll (200 bytes at most)."),
          ("GIF", "GIF played before the text: Category/name.gif"), ("Effect", "How the text comes in."), ("Colour", "Colour name or RRGGBB."),
          ("Speed", "1 (slow) to 10 (fast)."), ("Passes", "Number of passes of the GIF and the text (1 to 10)."),
          ("Font", "Pixel or a font file of the panel."), ("Size", "Size in pixels, 0 = automatic."),
          ("Blink", "Blinking text (priority alert).")],
  effects=["Scroll left", "Scroll right", "Rise", "Fall", "Letter by letter", "Raining letters", "Fade"],
  colors=["White", "Red", "Orange", "Amber", "Yellow", "Green", "Turquoise", "Blue", "Purple", "Pink", "Rainbow"]),
 "nl": dict(
  title="Een OrbitDMD-paneel koppelen", desc="Adres van het paneel (zoals in je browser, bijvoorbeeld orbitdmd.local of 192.168.1.50) en het wachtwoord van de webpagina.",
  host="Adres van het paneel", password="Wachtwoord van de webpagina", reauth="Het paneel weigert het wachtwoord: geef het huidige wachtwoord van de webpagina.",
  found="OrbitDMD-paneel gevonden", found_desc="Het paneel “{name}” is op het netwerk gevonden ({host}). Geef het wachtwoord van de webpagina om het te koppelen.",
  cannot="Paneel onbereikbaar: controleer het adres en of het aanstaat.", auth="Onjuist wachtwoord.", already="Dit paneel is al gekoppeld.",
  reauth_ok="Wachtwoord bijgewerkt.", not_orbitdmd="Dit apparaat is geen OrbitDMD-paneel.",
  pause="Pauze", hourly="Helderheid per uur", clock="Tijd tonen", weather="Weer tonen", restart="Herstarten",
  gif="Getoonde GIF", screen="Scherm", temp="Processortemperatuur", ip="IP-adres", version="Versie", message="Bericht",
  svc="Een melding tonen", svc_desc="Toont meteen een tekst en/of een GIF op het paneel, boven de GIF's.",
  screens=["GIF", "Tijd", "Datum", "Weer", "Bericht", "Tekst", "Aftelling", "Opstarten", "Testbeeld"],
  fields=[("Paneel", "Te gebruiken panelen (alle als leeg)."), ("Tekst", "Schuivende tekst (max. 200 bytes)."),
          ("GIF", "GIF vóór de tekst: Categorie/naam.gif"), ("Effect", "Hoe de tekst binnenkomt."), ("Kleur", "Kleurnaam of RRGGBB."),
          ("Snelheid", "1 (traag) tot 10 (snel)."), ("Doorgangen", "Aantal doorgangen van de GIF en de tekst (1 tot 10)."),
          ("Lettertype", "Pixel of een lettertypebestand van het paneel."), ("Grootte", "Grootte in pixels, 0 = automatisch."),
          ("Knipperen", "Knipperende tekst (prioritaire melding).")],
  effects=["Naar links", "Naar rechts", "Omhoog", "Omlaag", "Letter voor letter", "Regen van letters", "Vervagen"],
  colors=["Wit", "Rood", "Oranje", "Amber", "Geel", "Groen", "Turkoois", "Blauw", "Paars", "Roze", "Regenboog"]),
 "es": dict(
  title="Vincular un panel OrbitDMD", desc="Dirección del panel (como en su navegador, por ejemplo orbitdmd.local o 192.168.1.50) y contraseña de su página web.",
  host="Dirección del panel", password="Contraseña de la página web", reauth="El panel rechaza la contraseña: indique la contraseña actual de su página web.",
  found="Panel OrbitDMD encontrado", found_desc="Se ha encontrado el panel «{name}» en la red ({host}). Indique la contraseña de su página web para vincularlo.",
  cannot="Panel inaccesible: compruebe la dirección y que esté encendido.", auth="Contraseña incorrecta.", already="Este panel ya está vinculado.",
  reauth_ok="Contraseña actualizada.", not_orbitdmd="Este dispositivo no es un panel OrbitDMD.",
  pause="Pausa", hourly="Brillo hora a hora", clock="Mostrar la hora", weather="Mostrar el tiempo", restart="Reiniciar",
  gif="GIF mostrado", screen="Pantalla", temp="Temperatura del procesador", ip="Dirección IP", version="Versión", message="Mensaje",
  svc="Mostrar una notificación", svc_desc="Muestra enseguida un texto y/o un GIF en el panel, por encima de los GIF.",
  screens=["GIF", "Hora", "Fecha", "Tiempo", "Mensaje", "Texto", "Cuenta atrás", "Arranque", "Carta de ajuste"],
  fields=[("Panel", "Paneles a usar (todos si está vacío)."), ("Texto", "Texto que se desplaza (200 bytes como máximo)."),
          ("GIF", "GIF antes del texto: Categoria/nombre.gif"), ("Efecto", "Entrada del texto."), ("Color", "Nombre de color o RRGGBB."),
          ("Velocidad", "1 (lento) a 10 (rápido)."), ("Pasadas", "Número de pasadas del GIF y del texto (1 a 10)."),
          ("Fuente", "Pixel o un archivo de fuente del panel."), ("Tamaño", "Tamaño en píxeles, 0 = automático."),
          ("Parpadeo", "Texto parpadeante (alerta prioritaria).")],
  effects=["Hacia la izquierda", "Hacia la derecha", "Sube", "Baja", "Letra a letra", "Lluvia de letras", "Fundido"],
  colors=["Blanco", "Rojo", "Naranja", "Ámbar", "Amarillo", "Verde", "Turquesa", "Azul", "Violeta", "Rosa", "Arcoíris"]),
 "ru": dict(
  title="Подключить панель OrbitDMD", desc="Адрес панели (как в браузере, например orbitdmd.local или 192.168.1.50) и пароль её веб-страницы.",
  host="Адрес панели", password="Пароль веб-страницы", reauth="Панель не принимает пароль: укажите текущий пароль её веб-страницы.",
  found="Найдена панель OrbitDMD", found_desc="В сети найдена панель «{name}» ({host}). Укажите пароль её веб-страницы, чтобы подключить её.",
  cannot="Панель недоступна: проверьте адрес и что она включена.", auth="Неверный пароль.", already="Эта панель уже подключена.",
  reauth_ok="Пароль обновлён.", not_orbitdmd="Это устройство не является панелью OrbitDMD.",
  pause="Пауза", hourly="Яркость по часам", clock="Показать время", weather="Показать погоду", restart="Перезапустить",
  gif="Текущий GIF", screen="Экран", temp="Температура процессора", ip="IP-адрес", version="Версия", message="Сообщение",
  svc="Показать уведомление", svc_desc="Сразу показывает текст и/или GIF на панели поверх GIF.",
  screens=["GIF", "Время", "Дата", "Погода", "Сообщение", "Текст", "Обратный отсчёт", "Запуск", "Тестовая таблица"],
  fields=[("Панель", "Используемые панели (все, если пусто)."), ("Текст", "Бегущий текст (не более 200 байт)."),
          ("GIF", "GIF перед текстом: Категория/имя.gif"), ("Эффект", "Появление текста."), ("Цвет", "Название цвета или RRGGBB."),
          ("Скорость", "От 1 (медленно) до 10 (быстро)."), ("Проходы", "Число проходов GIF и текста (от 1 до 10)."),
          ("Шрифт", "Pixel или файл шрифта панели."), ("Размер", "Размер в пикселях, 0 = автоматически."),
          ("Мигание", "Мигающий текст (приоритетное оповещение).")],
  effects=["Влево", "Вправо", "Вверх", "Вниз", "По буквам", "Дождь из букв", "Плавно"],
  colors=["Белый", "Красный", "Оранжевый", "Янтарный", "Жёлтый", "Зелёный", "Бирюзовый", "Синий", "Фиолетовый", "Розовый", "Радуга"]),
 "de": dict(
  title="OrbitDMD-Panel verbinden", desc="Adresse des Panels (wie im Browser, z. B. orbitdmd.local oder 192.168.1.50) und das Passwort seiner Webseite.",
  host="Adresse des Panels", password="Passwort der Webseite", reauth="Das Panel lehnt das Passwort ab: Geben Sie das aktuelle Passwort seiner Webseite ein.",
  found="OrbitDMD-Panel gefunden", found_desc="Das Panel „{name}“ wurde im Netzwerk gefunden ({host}). Geben Sie das Passwort seiner Webseite ein, um es zu verbinden.",
  cannot="Panel nicht erreichbar: Prüfen Sie die Adresse und ob es eingeschaltet ist.", auth="Falsches Passwort.", already="Dieses Panel ist bereits verbunden.",
  reauth_ok="Passwort aktualisiert.", not_orbitdmd="Dieses Gerät ist kein OrbitDMD-Panel.",
  pause="Pause", hourly="Helligkeit nach Uhrzeit", clock="Uhrzeit anzeigen", weather="Wetter anzeigen", restart="Neu starten",
  gif="Angezeigtes GIF", screen="Bildschirm", temp="Prozessortemperatur", ip="IP-Adresse", version="Version", message="Nachricht",
  svc="Benachrichtigung anzeigen", svc_desc="Zeigt sofort einen Text und/oder ein GIF auf dem Panel, über den GIFs.",
  screens=["GIF", "Uhrzeit", "Datum", "Wetter", "Nachricht", "Text", "Countdown", "Start", "Testbild"],
  fields=[("Panel", "Zu verwendende Panels (alle, wenn leer)."), ("Text", "Lauftext (höchstens 200 Byte)."),
          ("GIF", "GIF vor dem Text: Kategorie/name.gif"), ("Effekt", "Wie der Text erscheint."), ("Farbe", "Farbname oder RRGGBB."),
          ("Geschwindigkeit", "1 (langsam) bis 10 (schnell)."), ("Durchläufe", "Anzahl der Durchläufe von GIF und Text (1 bis 10)."),
          ("Schrift", "Pixel oder eine Schriftdatei des Panels."), ("Größe", "Größe in Pixeln, 0 = automatisch."),
          ("Blinken", "Blinkender Text (prioritäre Meldung).")],
  effects=["Nach links", "Nach rechts", "Nach oben", "Nach unten", "Buchstabe für Buchstabe", "Buchstabenregen", "Einblenden"],
  colors=["Weiß", "Rot", "Orange", "Bernstein", "Gelb", "Grün", "Türkis", "Blau", "Violett", "Rosa", "Regenbogen"]),
 "it": dict(
  title="Collegare un pannello OrbitDMD", desc="Indirizzo del pannello (come nel browser, ad esempio orbitdmd.local o 192.168.1.50) e password della sua pagina web.",
  host="Indirizzo del pannello", password="Password della pagina web", reauth="Il pannello rifiuta la password: inserisci la password attuale della sua pagina web.",
  found="Pannello OrbitDMD trovato", found_desc="Il pannello «{name}» è stato trovato in rete ({host}). Inserisci la password della sua pagina web per collegarlo.",
  cannot="Pannello irraggiungibile: controlla l'indirizzo e che sia acceso.", auth="Password errata.", already="Questo pannello è già collegato.",
  reauth_ok="Password aggiornata.", not_orbitdmd="Questo dispositivo non è un pannello OrbitDMD.",
  pause="Pausa", hourly="Luminosità per ora", clock="Mostra l'ora", weather="Mostra il meteo", restart="Riavvia",
  gif="GIF mostrata", screen="Schermo", temp="Temperatura del processore", ip="Indirizzo IP", version="Versione", message="Messaggio",
  svc="Mostra una notifica", svc_desc="Mostra subito un testo e/o una GIF sul pannello, sopra le GIF.",
  screens=["GIF", "Ora", "Data", "Meteo", "Messaggio", "Testo", "Conto alla rovescia", "Avvio", "Monoscopio"],
  fields=[("Pannello", "Pannelli da usare (tutti se vuoto)."), ("Testo", "Testo che scorre (al massimo 200 byte)."),
          ("GIF", "GIF prima del testo: Categoria/nome.gif"), ("Effetto", "Arrivo del testo."), ("Colore", "Nome del colore o RRGGBB."),
          ("Velocità", "Da 1 (lento) a 10 (veloce)."), ("Passaggi", "Numero di passaggi della GIF e del testo (da 1 a 10)."),
          ("Carattere", "Pixel o un file di carattere del pannello."), ("Dimensione", "Dimensione in pixel, 0 = automatica."),
          ("Lampeggio", "Testo lampeggiante (avviso prioritario).")],
  effects=["A sinistra", "A destra", "Sale", "Scende", "Lettera per lettera", "Pioggia di lettere", "Dissolvenza"],
  colors=["Bianco", "Rosso", "Arancione", "Ambra", "Giallo", "Verde", "Turchese", "Blu", "Viola", "Rosa", "Arcobaleno"]),
 "pt": dict(
  title="Ligar um painel OrbitDMD", desc="Endereço do painel (como no seu navegador, por exemplo orbitdmd.local ou 192.168.1.50) e palavra-passe da sua página web.",
  host="Endereço do painel", password="Palavra-passe da página web", reauth="O painel recusa a palavra-passe: indique a palavra-passe atual da sua página web.",
  found="Painel OrbitDMD encontrado", found_desc="O painel «{name}» foi encontrado na rede ({host}). Indique a palavra-passe da sua página web para o ligar.",
  cannot="Painel inacessível: verifique o endereço e se está ligado.", auth="Palavra-passe incorreta.", already="Este painel já está ligado.",
  reauth_ok="Palavra-passe atualizada.", not_orbitdmd="Este dispositivo não é um painel OrbitDMD.",
  pause="Pausa", hourly="Brilho por hora", clock="Mostrar a hora", weather="Mostrar a meteorologia", restart="Reiniciar",
  gif="GIF mostrado", screen="Ecrã", temp="Temperatura do processador", ip="Endereço IP", version="Versão", message="Mensagem",
  svc="Mostrar uma notificação", svc_desc="Mostra de imediato um texto e/ou um GIF no painel, por cima dos GIF.",
  screens=["GIF", "Hora", "Data", "Meteorologia", "Mensagem", "Texto", "Contagem decrescente", "Arranque", "Padrão de teste"],
  fields=[("Painel", "Painéis a usar (todos se vazio)."), ("Texto", "Texto que desliza (no máximo 200 bytes)."),
          ("GIF", "GIF antes do texto: Categoria/nome.gif"), ("Efeito", "Entrada do texto."), ("Cor", "Nome da cor ou RRGGBB."),
          ("Velocidade", "1 (lento) a 10 (rápido)."), ("Passagens", "Número de passagens do GIF e do texto (1 a 10)."),
          ("Tipo de letra", "Pixel ou um ficheiro de tipo de letra do painel."), ("Tamanho", "Tamanho em píxeis, 0 = automático."),
          ("Piscar", "Texto a piscar (alerta prioritário).")],
  effects=["Para a esquerda", "Para a direita", "Sobe", "Desce", "Letra por letra", "Chuva de letras", "Esmaecer"],
  colors=["Branco", "Vermelho", "Laranja", "Âmbar", "Amarelo", "Verde", "Turquesa", "Azul", "Roxo", "Rosa", "Arco-íris"]),
 "pl": dict(
  title="Połącz panel OrbitDMD", desc="Adres panelu (jak w przeglądarce, np. orbitdmd.local lub 192.168.1.50) i hasło jego strony WWW.",
  host="Adres panelu", password="Hasło strony WWW", reauth="Panel odrzuca hasło: podaj aktualne hasło jego strony WWW.",
  found="Znaleziono panel OrbitDMD", found_desc="W sieci znaleziono panel „{name}” ({host}). Podaj hasło jego strony WWW, aby go połączyć.",
  cannot="Panel nieosiągalny: sprawdź adres i czy jest włączony.", auth="Nieprawidłowe hasło.", already="Ten panel jest już połączony.",
  reauth_ok="Hasło zaktualizowane.", not_orbitdmd="To urządzenie nie jest panelem OrbitDMD.",
  pause="Pauza", hourly="Jasność według godzin", clock="Pokaż godzinę", weather="Pokaż pogodę", restart="Uruchom ponownie",
  gif="Wyświetlany GIF", screen="Ekran", temp="Temperatura procesora", ip="Adres IP", version="Wersja", message="Wiadomość",
  svc="Pokaż powiadomienie", svc_desc="Od razu wyświetla tekst i/lub GIF na panelu, ponad GIF-ami.",
  screens=["GIF", "Godzina", "Data", "Pogoda", "Wiadomość", "Tekst", "Odliczanie", "Uruchamianie", "Obraz testowy"],
  fields=[("Panel", "Używane panele (wszystkie, jeśli puste)."), ("Tekst", "Przewijany tekst (najwyżej 200 bajtów)."),
          ("GIF", "GIF przed tekstem: Kategoria/nazwa.gif"), ("Efekt", "Pojawianie się tekstu."), ("Kolor", "Nazwa koloru lub RRGGBB."),
          ("Prędkość", "Od 1 (wolno) do 10 (szybko)."), ("Przebiegi", "Liczba przebiegów GIF-a i tekstu (od 1 do 10)."),
          ("Czcionka", "Pixel lub plik czcionki panelu."), ("Rozmiar", "Rozmiar w pikselach, 0 = automatycznie."),
          ("Miganie", "Migający tekst (powiadomienie priorytetowe).")],
  effects=["W lewo", "W prawo", "W górę", "W dół", "Litera po literze", "Deszcz liter", "Przenikanie"],
  colors=["Biały", "Czerwony", "Pomarańczowy", "Bursztynowy", "Żółty", "Zielony", "Turkusowy", "Niebieski", "Fioletowy", "Różowy", "Tęcza"]),
 "uk": dict(
  title="Підключити панель OrbitDMD", desc="Адреса панелі (як у браузері, наприклад orbitdmd.local або 192.168.1.50) і пароль її вебсторінки.",
  host="Адреса панелі", password="Пароль вебсторінки", reauth="Панель не приймає пароль: вкажіть поточний пароль її вебсторінки.",
  found="Знайдено панель OrbitDMD", found_desc="У мережі знайдено панель «{name}» ({host}). Вкажіть пароль її вебсторінки, щоб підключити її.",
  cannot="Панель недоступна: перевірте адресу і чи вона увімкнена.", auth="Неправильний пароль.", already="Цю панель уже підключено.",
  reauth_ok="Пароль оновлено.", not_orbitdmd="Цей пристрій не є панеллю OrbitDMD.",
  pause="Пауза", hourly="Яскравість за годинами", clock="Показати час", weather="Показати погоду", restart="Перезапустити",
  gif="Поточний GIF", screen="Екран", temp="Температура процесора", ip="IP-адреса", version="Версія", message="Повідомлення",
  svc="Показати сповіщення", svc_desc="Одразу показує текст і/або GIF на панелі поверх GIF.",
  screens=["GIF", "Час", "Дата", "Погода", "Повідомлення", "Текст", "Зворотний відлік", "Запуск", "Тестова таблиця"],
  fields=[("Панель", "Панелі для використання (усі, якщо порожньо)."), ("Текст", "Рухомий текст (не більше 200 байтів)."),
          ("GIF", "GIF перед текстом: Категорія/назва.gif"), ("Ефект", "Поява тексту."), ("Колір", "Назва кольору або RRGGBB."),
          ("Швидкість", "Від 1 (повільно) до 10 (швидко)."), ("Проходи", "Кількість проходів GIF і тексту (від 1 до 10)."),
          ("Шрифт", "Pixel або файл шрифту панелі."), ("Розмір", "Розмір у пікселях, 0 = автоматично."),
          ("Блимання", "Блимаючий текст (пріоритетне сповіщення).")],
  effects=["Ліворуч", "Праворуч", "Вгору", "Вниз", "По літерах", "Дощ із літер", "Плавно"],
  colors=["Білий", "Червоний", "Помаранчевий", "Бурштиновий", "Жовтий", "Зелений", "Бірюзовий", "Синій", "Фіолетовий", "Рожевий", "Веселка"]),
 "tr": dict(
  title="Bir OrbitDMD paneli bağla", desc="Panelin adresi (tarayıcınızdaki gibi, örneğin orbitdmd.local veya 192.168.1.50) ve web sayfasının parolası.",
  host="Panel adresi", password="Web sayfası parolası", reauth="Panel parolayı reddediyor: web sayfasının güncel parolasını girin.",
  found="OrbitDMD paneli bulundu", found_desc="“{name}” paneli ağda bulundu ({host}). Bağlamak için web sayfasının parolasını girin.",
  cannot="Panele ulaşılamıyor: adresi ve açık olduğunu kontrol edin.", auth="Yanlış parola.", already="Bu panel zaten bağlı.",
  reauth_ok="Parola güncellendi.", not_orbitdmd="Bu cihaz bir OrbitDMD paneli değil.",
  pause="Duraklat", hourly="Saate göre parlaklık", clock="Saati göster", weather="Hava durumunu göster", restart="Yeniden başlat",
  gif="Gösterilen GIF", screen="Ekran", temp="İşlemci sıcaklığı", ip="IP adresi", version="Sürüm", message="Mesaj",
  svc="Bildirim göster", svc_desc="Panelde GIF'lerin üzerinde hemen bir metin ve/veya GIF gösterir.",
  screens=["GIF", "Saat", "Tarih", "Hava durumu", "Mesaj", "Metin", "Geri sayım", "Başlangıç", "Test deseni"],
  fields=[("Panel", "Kullanılacak paneller (boşsa hepsi)."), ("Metin", "Kayan metin (en fazla 200 bayt)."),
          ("GIF", "Metinden önceki GIF: Kategori/ad.gif"), ("Efekt", "Metnin gelişi."), ("Renk", "Renk adı veya RRGGBB."),
          ("Hız", "1 (yavaş) ile 10 (hızlı) arası."), ("Geçişler", "GIF ve metnin geçiş sayısı (1 ile 10 arası)."),
          ("Yazı tipi", "Pixel veya panelin bir yazı tipi dosyası."), ("Boyut", "Piksel cinsinden boyut, 0 = otomatik."),
          ("Yanıp sönme", "Yanıp sönen metin (öncelikli uyarı).")],
  effects=["Sola", "Sağa", "Yukarı", "Aşağı", "Harf harf", "Harf yağmuru", "Solma"],
  colors=["Beyaz", "Kırmızı", "Turuncu", "Kehribar", "Sarı", "Yeşil", "Turkuaz", "Mavi", "Mor", "Pembe", "Gökkuşağı"]),
 "cs": dict(
  title="Připojit panel OrbitDMD", desc="Adresa panelu (jako v prohlížeči, např. orbitdmd.local nebo 192.168.1.50) a heslo jeho webové stránky.",
  host="Adresa panelu", password="Heslo webové stránky", reauth="Panel odmítá heslo: zadejte aktuální heslo jeho webové stránky.",
  found="Nalezen panel OrbitDMD", found_desc="V síti byl nalezen panel „{name}“ ({host}). Zadejte heslo jeho webové stránky a připojte ho.",
  cannot="Panel je nedostupný: zkontrolujte adresu a zda je zapnutý.", auth="Nesprávné heslo.", already="Tento panel je už připojen.",
  reauth_ok="Heslo aktualizováno.", not_orbitdmd="Toto zařízení není panel OrbitDMD.",
  pause="Pauza", hourly="Jas podle hodin", clock="Zobrazit čas", weather="Zobrazit počasí", restart="Restartovat",
  gif="Zobrazený GIF", screen="Obrazovka", temp="Teplota procesoru", ip="IP adresa", version="Verze", message="Zpráva",
  svc="Zobrazit upozornění", svc_desc="Okamžitě zobrazí na panelu text a/nebo GIF přes GIFy.",
  screens=["GIF", "Čas", "Datum", "Počasí", "Zpráva", "Text", "Odpočet", "Spuštění", "Testovací obrazec"],
  fields=[("Panel", "Použité panely (všechny, je-li prázdné)."), ("Text", "Běžící text (nejvýše 200 bajtů)."),
          ("GIF", "GIF před textem: Kategorie/název.gif"), ("Efekt", "Příchod textu."), ("Barva", "Název barvy nebo RRGGBB."),
          ("Rychlost", "Od 1 (pomalu) do 10 (rychle)."), ("Průchody", "Počet průchodů GIFu a textu (od 1 do 10)."),
          ("Písmo", "Pixel nebo soubor písma panelu."), ("Velikost", "Velikost v pixelech, 0 = automaticky."),
          ("Blikání", "Blikající text (prioritní upozornění).")],
  effects=["Doleva", "Doprava", "Nahoru", "Dolů", "Písmeno po písmenu", "Déšť písmen", "Prolínání"],
  colors=["Bílá", "Červená", "Oranžová", "Jantarová", "Žlutá", "Zelená", "Tyrkysová", "Modrá", "Fialová", "Růžová", "Duha"]),
}

# Reparations et erreurs : (titre, description, erreur "trop ancien", aucun panneau, ni texte ni GIF, refus du panneau)
# placeholders : {name} {version} {minimum} {error}
E = {
 "fr": ("Mettez à jour le panneau OrbitDMD « {name} »",
        "Le panneau « {name} » a le programme {version}. L'intégration a besoin de la version {minimum} ou plus récente pour afficher les alertes. Téléchargez le dernier programme (lien ci-dessous), puis installez-le depuis la page web du panneau : Système → Nouveau programme.",
        "Le panneau « {name} » a le programme {version} : installez la version {minimum} ou plus récente (page web du panneau → Système → Nouveau programme).",
        "Aucun panneau OrbitDMD n'est relié.", "Il faut un texte ou une GIF.", "Le panneau a refusé : {error}"),
 "en": ("Update the OrbitDMD panel “{name}”",
        "The panel “{name}” runs program {version}. The integration needs version {minimum} or later to show alerts. Download the latest program (link below), then install it from the panel's web page: System → New program.",
        "The panel “{name}” runs program {version}: install version {minimum} or later (panel web page → System → New program).",
        "No OrbitDMD panel is set up.", "A text or a GIF is needed.", "The panel refused: {error}"),
 "nl": ("Werk het OrbitDMD-paneel “{name}” bij",
        "Het paneel “{name}” heeft programma {version}. De integratie heeft versie {minimum} of nieuwer nodig om meldingen te tonen. Download het nieuwste programma (link hieronder) en installeer het via de webpagina van het paneel: Systeem → Nieuw programma.",
        "Het paneel “{name}” heeft programma {version}: installeer versie {minimum} of nieuwer (webpagina van het paneel → Systeem → Nieuw programma).",
        "Er is geen OrbitDMD-paneel gekoppeld.", "Er is een tekst of een GIF nodig.", "Het paneel weigerde: {error}"),
 "es": ("Actualice el panel OrbitDMD «{name}»",
        "El panel «{name}» tiene el programa {version}. La integración necesita la versión {minimum} o posterior para mostrar las alertas. Descargue el último programa (enlace abajo) e instálelo desde la página web del panel: Sistema → Nuevo programa.",
        "El panel «{name}» tiene el programa {version}: instale la versión {minimum} o posterior (página web del panel → Sistema → Nuevo programa).",
        "No hay ningún panel OrbitDMD vinculado.", "Hace falta un texto o un GIF.", "El panel lo rechazó: {error}"),
 "ru": ("Обновите панель OrbitDMD «{name}»",
        "На панели «{name}» установлена программа {version}. Для показа оповещений интеграции нужна версия {minimum} или новее. Скачайте последнюю программу (ссылка ниже) и установите её через веб-страницу панели: Система → Новая программа.",
        "На панели «{name}» программа {version}: установите версию {minimum} или новее (веб-страница панели → Система → Новая программа).",
        "Панель OrbitDMD не подключена.", "Нужен текст или GIF.", "Панель отказала: {error}"),
 "de": ("Aktualisieren Sie das OrbitDMD-Panel „{name}“",
        "Das Panel „{name}“ hat das Programm {version}. Die Integration benötigt Version {minimum} oder neuer, um Meldungen anzuzeigen. Laden Sie das neueste Programm herunter (Link unten) und installieren Sie es über die Webseite des Panels: System → Neues Programm.",
        "Das Panel „{name}“ hat das Programm {version}: Installieren Sie Version {minimum} oder neuer (Webseite des Panels → System → Neues Programm).",
        "Kein OrbitDMD-Panel verbunden.", "Ein Text oder ein GIF ist nötig.", "Das Panel hat abgelehnt: {error}"),
 "it": ("Aggiorna il pannello OrbitDMD «{name}»",
        "Il pannello «{name}» ha il programma {version}. L'integrazione richiede la versione {minimum} o successiva per mostrare gli avvisi. Scarica l'ultimo programma (link qui sotto) e installalo dalla pagina web del pannello: Sistema → Nuovo programma.",
        "Il pannello «{name}» ha il programma {version}: installa la versione {minimum} o successiva (pagina web del pannello → Sistema → Nuovo programma).",
        "Nessun pannello OrbitDMD collegato.", "Serve un testo o una GIF.", "Il pannello ha rifiutato: {error}"),
 "pt": ("Atualize o painel OrbitDMD «{name}»",
        "O painel «{name}» tem o programa {version}. A integração precisa da versão {minimum} ou mais recente para mostrar os alertas. Transfira o programa mais recente (ligação abaixo) e instale-o a partir da página web do painel: Sistema → Novo programa.",
        "O painel «{name}» tem o programa {version}: instale a versão {minimum} ou mais recente (página web do painel → Sistema → Novo programa).",
        "Nenhum painel OrbitDMD ligado.", "É preciso um texto ou um GIF.", "O painel recusou: {error}"),
 "pl": ("Zaktualizuj panel OrbitDMD „{name}”",
        "Panel „{name}” ma program {version}. Do wyświetlania powiadomień integracja wymaga wersji {minimum} lub nowszej. Pobierz najnowszy program (link poniżej) i zainstaluj go ze strony WWW panelu: System → Nowy program.",
        "Panel „{name}” ma program {version}: zainstaluj wersję {minimum} lub nowszą (strona WWW panelu → System → Nowy program).",
        "Nie połączono żadnego panelu OrbitDMD.", "Potrzebny jest tekst lub GIF.", "Panel odmówił: {error}"),
 "uk": ("Оновіть панель OrbitDMD «{name}»",
        "На панелі «{name}» встановлено програму {version}. Для показу сповіщень інтеграції потрібна версія {minimum} або новіша. Завантажте останню програму (посилання нижче) і встановіть її через вебсторінку панелі: Система → Нова програма.",
        "На панелі «{name}» програма {version}: встановіть версію {minimum} або новішу (вебсторінка панелі → Система → Нова програма).",
        "Панель OrbitDMD не підключено.", "Потрібен текст або GIF.", "Панель відмовила: {error}"),
 "tr": ("OrbitDMD paneli “{name}” güncelleyin",
        "“{name}” panelinde {version} programı var. Entegrasyonun uyarıları gösterebilmesi için {minimum} veya daha yeni sürüm gerekir. En son programı indirin (aşağıdaki bağlantı) ve panelin web sayfasından yükleyin: Sistem → Yeni program.",
        "“{name}” panelinde {version} programı var: {minimum} veya daha yeni sürümü yükleyin (panelin web sayfası → Sistem → Yeni program).",
        "Bağlı OrbitDMD paneli yok.", "Bir metin veya GIF gerekli.", "Panel reddetti: {error}"),
 "cs": ("Aktualizujte panel OrbitDMD „{name}“",
        "Panel „{name}“ má program {version}. Integrace potřebuje k zobrazení upozornění verzi {minimum} nebo novější. Stáhněte nejnovější program (odkaz níže) a nainstalujte ho z webové stránky panelu: Systém → Nový program.",
        "Panel „{name}“ má program {version}: nainstalujte verzi {minimum} nebo novější (webová stránka panelu → Systém → Nový program).",
        "Žádný panel OrbitDMD není připojen.", "Je potřeba text nebo GIF.", "Panel odmítl: {error}"),
}


# champ "icone" (panneau 1.7.0+) : petite GIF animee a gauche du texte
ICON = {
 "fr": ("Icône", "Petite GIF animée à gauche du texte : Icones/nom.gif (le texte défile à côté)."),
 "en": ("Icon", "Small animated GIF left of the text: Icones/name.gif (the text scrolls beside it)."),
 "nl": ("Pictogram", "Kleine geanimeerde GIF links van de tekst: Icones/naam.gif (de tekst schuift ernaast)."),
 "es": ("Icono", "GIF animado pequeño a la izquierda del texto: Icones/nombre.gif (el texto se desplaza al lado)."),
 "ru": ("Значок", "Маленький анимированный GIF слева от текста: Icones/имя.gif (текст бежит рядом)."),
 "de": ("Symbol", "Kleines animiertes GIF links vom Text: Icones/name.gif (der Text läuft daneben)."),
 "it": ("Icona", "Piccola GIF animata a sinistra del testo: Icones/nome.gif (il testo scorre accanto)."),
 "pt": ("Ícone", "Pequeno GIF animado à esquerda do texto: Icones/nome.gif (o texto desliza ao lado)."),
 "pl": ("Ikona", "Mały animowany GIF po lewej stronie tekstu: Icones/nazwa.gif (tekst przewija się obok)."),
 "uk": ("Значок", "Маленький анімований GIF ліворуч від тексту: Icones/назва.gif (текст біжить поруч)."),
 "tr": ("Simge", "Metnin solunda küçük hareketli GIF: Icones/ad.gif (metin yanında kayar)."),
 "cs": ("Ikona", "Malý animovaný GIF vlevo od textu: Icones/název.gif (text běží vedle)."),
}


# champ "lignes" (panneau 1.7.0+) : deux lignes par page pour les effets en pages
LINES = {
 "fr": ("Lignes", "2 : le texte sur deux lignes, l'une sous l'autre (effets Monte, Descend, Lettre par lettre, Pluie, Fondu)."),
 "en": ("Lines", "2: the text on two lines, one under the other (effects Up, Down, Letter by letter, Rain, Fade)."),
 "nl": ("Regels", "2: de tekst op twee regels onder elkaar (effecten Omhoog, Omlaag, Letter voor letter, Regen, Vervagen)."),
 "es": ("Líneas", "2: el texto en dos líneas, una debajo de otra (efectos Sube, Baja, Letra a letra, Lluvia, Fundido)."),
 "ru": ("Строки", "2: текст в две строки, одна под другой (эффекты Вверх, Вниз, По буквам, Дождь, Затухание)."),
 "de": ("Zeilen", "2: der Text auf zwei Zeilen untereinander (Effekte Hoch, Runter, Buchstabe für Buchstabe, Regen, Überblenden)."),
 "it": ("Righe", "2: il testo su due righe, una sotto l'altra (effetti Sale, Scende, Lettera per lettera, Pioggia, Dissolvenza)."),
 "pt": ("Linhas", "2: o texto em duas linhas, uma por baixo da outra (efeitos Sobe, Desce, Letra a letra, Chuva, Desvanecer)."),
 "pl": ("Wiersze", "2: tekst w dwóch wierszach, jeden pod drugim (efekty W górę, W dół, Litera po literze, Deszcz, Zanikanie)."),
 "uk": ("Рядки", "2: текст у два рядки, один під одним (ефекти Вгору, Вниз, По літерах, Дощ, Згасання)."),
 "tr": ("Satırlar", "2: metin alt alta iki satırda (Yukarı, Aşağı, Harf harf, Yağmur, Solma efektleri)."),
 "cs": ("Řádky", "2: text na dvou řádcích pod sebou (efekty Nahoru, Dolů, Písmeno po písmenu, Déšť, Prolínání)."),
}


def build(t: dict, e: tuple, icon: tuple, lines: tuple) -> dict:
    fields = dict(zip(FIELDS, t["fields"]))
    fields["icon"] = icon
    fields["lines"] = lines
    return {
        "config": {
            "flow_title": "{name}",
            "step": {
                "user": {"title": t["title"], "description": t["desc"], "data": {"host": t["host"], "password": t["password"]}},
                "zeroconf_confirm": {"title": t["found"], "description": t["found_desc"], "data": {"password": t["password"]}},
                "reauth_confirm": {"description": t["reauth"], "data": {"password": t["password"]}},
            },
            "error": {"cannot_connect": t["cannot"], "invalid_auth": t["auth"]},
            "abort": {"already_configured": t["already"], "reauth_successful": t["reauth_ok"],
                      "cannot_connect": t["cannot"], "not_orbitdmd": t["not_orbitdmd"]},
        },
        "entity": {
            "switch": {"pause": {"name": t["pause"]}, "hourly_brightness": {"name": t["hourly"]}},
            "button": {"show_clock": {"name": t["clock"]}, "show_weather": {"name": t["weather"]}, "restart": {"name": t["restart"]}},
            "sensor": {"gif": {"name": t["gif"]}, "screen": {"name": t["screen"], "state": dict(zip(SCREENS, t["screens"]))},
                       "temperature": {"name": t["temp"]}, "ip": {"name": t["ip"]}, "version": {"name": t["version"]}},
            "notify": {"message": {"name": t["message"]}},
        },
        "services": {"notify": {"name": t["svc"], "description": t["svc_desc"],
                                "fields": {k: {"name": v[0], "description": v[1]} for k, v in fields.items()}}},
        "selector": {"effect": {"options": dict(zip(EFFECTS, t["effects"]))}, "color": {"options": dict(zip(COLORS, t["colors"]))}},
        "device_automation": {"action_type": {"notify": t["svc"]},
                              "extra_fields": {k: fields[k][0] for k in ("message", "gif", "effect", "color", "speed", "passes", "blink", "icon")}},
        "issues": {"panel_too_old": {"title": e[0], "description": e[1]}},
        "exceptions": {"panel_too_old": {"message": e[2]}, "no_panel": {"message": e[3]},
                       "need_content": {"message": e[4]}, "panel_error": {"message": e[5]}},
    }


def main() -> None:
    os.makedirs(os.path.join(D, "translations"), exist_ok=True)
    for lang, t in T.items():
        assert len(t["screens"]) == len(SCREENS) and len(t["fields"]) == len(FIELDS), lang
        assert len(t["effects"]) == len(EFFECTS) and len(t["colors"]) == len(COLORS), lang
        assert "{name}" in t["found_desc"] and "{host}" in t["found_desc"], lang
        e = E[lang]
        need = ("{name}", "{version}", "{minimum}")
        assert "{name}" in e[0] and all(k in e[1] for k in need) and all(k in e[2] for k in need), lang
        assert "{error}" in e[5], lang
        text = json.dumps(build(t, e, ICON[lang], LINES[lang]), ensure_ascii=False, indent=2) + "\n"
        with open(os.path.join(D, "translations", f"{lang}.json"), "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        if lang == "en":
            with open(os.path.join(D, "strings.json"), "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
    print("ok :", ", ".join(T))


if __name__ == "__main__":
    main()
