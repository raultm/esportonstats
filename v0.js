document.addEventListener('DOMContentLoaded', function () {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    function showTab(tabId) {
        tabPanes.forEach(pane => {
            pane.classList.remove('active');
        });
        tabButtons.forEach(button => {
            button.classList.remove('active');
        });

        const selectedPane = document.getElementById(tabId);
        const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);

        if (selectedPane && selectedButton) {
            selectedPane.classList.add('active');
            selectedButton.classList.add('active');
        }
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');
            showTab(tabId);
        });
    });
});

var db;
var xhr = new XMLHttpRequest();
xhr.open('GET', 'data/esporton.sqlite', true);
xhr.responseType = 'arraybuffer';
xhr.onload = async e => {
    console.log("Leida sqlite")
    db = new SQL.Database(new Uint8Array(xhr.response))
    const lastThreeMonthsGamesInfluence = document.getElementById("last-three-months-games-influence")
    const lastThreeMonthsGamesPlayed = document.getElementById("last-three-months-games-played")
    const lastThreeMonthsUsers = document.getElementById("last-three-months-users")
    const lastThreeMonthsLocations = document.getElementById("last-three-months-locations")
    const yearGamesInfluence = document.getElementById("year-games-influence");
    const yearGamesPlayed = document.getElementById("year-games-played");
    const yearUsers = document.getElementById("year-users");
    const yearLocations = document.getElementById("year-locations");

    const data = await fetchDashboardData();
    console.log(data)
    renderList(lastThreeMonthsGamesInfluence, data.lastThreeMonths.games.influence)
    renderList(lastThreeMonthsGamesPlayed, data.lastThreeMonths.games.played)
    renderList(lastThreeMonthsUsers, data.lastThreeMonths.users, "cambiarImagenJugador")
    renderList(lastThreeMonthsLocations, data.lastThreeMonths.locations, "cambiarImagenLugar")
    renderList(yearGamesInfluence, data.year.games.influence)
    renderList(yearGamesPlayed, data.year.games.played)
    renderList(yearUsers, data.year.users, "cambiarImagenJugador")
    renderList(yearLocations, data.year.locations, "cambiarImagenLugar")

    // const dataExplorer = data.tabla; //await fetchExplorerData();
    // pintarTabla(dataExplorer)
}
xhr.send();

function renderList(element, data, fallbackImages = "cambiarImagenJuego") {
    console.log("renderList", element, data)
    if(!data) { return 'No Data' }
    element.innerHTML = data
        .map(item => `<li class="top-item"><img id="imagen-principal" src="${item.image}" alt="${item.name}" onerror="${fallbackImages}(this)" />
<br /><div class="info">${item.name} (<span>${item.total}</span>)</div></li>`)
        .join("");
}

function execSQL(sql) {
    if (!db) { console.log("Database not loaded yet"); return; }
    return timed(() => db.exec(sql), sql)
}

function timed(fn, msg = "") {
    console.time("exec: " + msg)
    let result = fn()
    console.timeEnd("exec: " + msg)
    return result
}
function threeMonthsAgo() {
    // Fecha actual
    const fechaActual = new Date();

    // Restar tres meses
    const tresMesesAtras = new Date(fechaActual);
    tresMesesAtras.setMonth(fechaActual.getMonth() - 3);

    // Convertir a cadena en formato "YYYY-MM-DD"
    return tresMesesAtras.toISOString().split('T')[0];
}

function top5(entitesCount) {
    // console.log("entitiesCount", entitesCount)
    return Object.entries(entitesCount)
        .map(([id, {total, name, image}]) => ({ name, total, image}))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
}

function parsePlay(recorder, record, juegos, jugadores) {
    //console.log("record", record, juegos, jugadores, juegos[record[3]][1])
    return {
        id: record[0],
        date: record[1],
        reporter: record[2],
        game: juegos[record[3]][2],
        players: parsePlayers(JSON.parse(record[4])),
        locations: JSON.parse(record[5]),
    }
}
function parsePlayers(players) {
    if (!players || !Array.isArray(players)) return [];
    if (Array.isArray(players)) return players.map(parsePlayer);
    return [parsePlayer(players)];
}

function parsePlayer(player) {
    //console.log("player", player)
    return {
        //id: player["_attributes"].userid,
        //username: player["_attributes"].username,
        name: player,
        //score: player["_attributes"].score
    }
}

async function fetchDashboardData() {

    let partidas = execSQL("SELECT * FROM partidas")[0].values
    let juegos = arrayToObject(execSQL("SELECT * FROM juegos")[0].values)
    let jugadores = arrayToObject(execSQL("SELECT * FROM jugadores")[0].values)
    //console.log(juegos, jugadores)
    const fields = [
        "id",
        "fecha",
        "reportador",
        "juego",
        "jugadores",
        "localizaciones"
    ]
    
    //console.log(partidas[0])
    let partidasUltimos3Meses = partidas.filter((partida) => partida[1] > threeMonthsAgo())
    //console.log(partidasUltimos3Meses)
    return {
        tabla: partidas.map(partidaBGG => parsePlay("", partidaBGG, juegos, jugadores)),
        lastThreeMonths: {
            games: {
                influence: top5(partidasUltimos3Meses.reduce(reduceJuegosPorInfluencia(juegos), {})),
                played: top5(partidasUltimos3Meses.reduce(reduceJuegos(juegos), {})),
            },
            users: top5(partidasUltimos3Meses.map(partidaBGG => parsePlay("", partidaBGG,juegos, jugadores)).reduce(reduceJugadores(jugadores), {})),
            locations: top5(partidasUltimos3Meses.map(partidaBGG => parsePlay(partidaBGG[1], partidaBGG, juegos, jugadores)).reduce(reduceLocations(), {}))

        },
        year: {
            games: {
                influence: top5(partidas.reduce(reduceJuegosPorInfluencia(juegos), {})),
                played: top5(partidas.reduce(reduceJuegos(juegos), {}), {}),
            },
            users: top5(partidas.map(partidaBGG => parsePlay("", partidaBGG,juegos, jugadores)).reduce(reduceJugadores(jugadores), {})),
            locations: top5(partidas.map(partidaBGG => parsePlay(partidaBGG[1], partidaBGG, juegos, jugadores)).reduce(reduceLocations(), {}))

        },
    };

    
}

function reduceJuegos(juegos) {

    return (acc, partida) => {
        if(!acc[partida[3]]){
            acc[partida[3]] = {total: 0, name:juegos[partida[3]][1], image: juegos[partida[3]][3] }
        }
        acc[partida[3]].total+= + 1;
        return acc;
    };
}

function reduceJuegosPorInfluencia(juegos) {
    
    return (acc, partida) => {
        // console.log("reduceJuegosPorInfluencia", acc, partida)
        if(!acc[partida[3]]){
            acc[partida[3]] = {
                total: 0, 
                name:juegos[partida[3]][1], 
                image: juegos[partida[3]][3],
                weight: juegos[partida[3]][4]
            }
        }
        acc[partida[3]].total+= 1 * acc[partida[3]].weight;
        acc[partida[3]].total = Math.round(acc[partida[3]].total * 100) / 100
        return acc;
    };
}

function reduceJugadores(jugadores) {

    return (acc, partida) => {
        partida.players
            .filter(player => player && jugadores[player.name][1] != "Anonymous player")    
            .map(player => {
                // console.log("player", player, jugadores[player.name])
                if(!acc[player.name]){
                    acc[player.name] = {total: 0, name:jugadores[player.name][1], image: jugadores[player.name][4] }
                }
                acc[player.name].total+= + 1;
            })
        return acc;
    }
}

function reduceLocations() {
    return (acc, partida) => {
        partida.locations
            .filter(location => location)
            .map(location => {
                if(!acc[location]){
                    acc[location] = {total: 0, name:location, image: '' }
                }
                acc[location].total += 1
            })
        return acc;
    }
}



function cambiarImagenJuego(imgElement) {

    const fallbackImages = [
        "boardgame_1.png",
        "boardgame_2.png",
        "boardgame_3.png",
    ];
    const src = fallbackImages[Math.floor(Math.random() * fallbackImages.length)]
    imgElement.src = "assets/" + src
}

function cambiarImagenJugador(imgElement) {

    const fallbackImages = [
        "user.png",
    ];
    const src = fallbackImages[Math.floor(Math.random() * fallbackImages.length)]
    imgElement.src = "assets/" + src
}

function cambiarImagenLugar(imgElement) {

    const fallbackImages = [
        "location_1.png",
        "location_2.png",
        "location_3.png",
        "location_4.png",
        "location_5.png",
        "location_6.png",
    ];
    const src = fallbackImages[Math.floor(Math.random() * fallbackImages.length)]
    imgElement.src = "assets/" + src
}

function arrayToObject(arrayToMap) {
    return arrayToMap.reduce((acc, item) => {
        acc[item[0]] = item;
        return acc;
    }, {})
}