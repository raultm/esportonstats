import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

export const normalizedDBBuilder = (config) => ({
    basePath: config?.path == ":memory:"? "" :path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
    path: config?.path ?? "/data/esporton.test.sqlite",
    db: null,
    normalizeData: async function (rawDB) {
        let plays = await rawDB.getPlaysWithoutDuplicates()
        let playersArray = await rawDB.getPlayers()
        let gamesArray = await rawDB.getGames()
        let players = this.arrayToObject(playersArray)
        let locations = this.arrayToObject(await rawDB.getLocations())
        let games = this.arrayToObject(gamesArray)
        await this.saveJugadores(playersArray)
        await this.saveJuegos(gamesArray)
        
        //console.log(plays)
        return plays.map(play => {
            if (typeof play.json === "string") play.json = JSON.parse(play.json)
            let localizaciones = play.json.location?.split(",")
                .map(location => {
                    let localizacion = locations[`${play.reporter}_${location.trim().toLowerCase().replaceAll(" ", "_")}`]
                    return localizacion?.mapTo ? locations[localizacion.mapTo].name : locations[localizacion]?.name
                })
            return {
                id: play.id,
                fecha: play.date,
                reportador: play.reporter,
                localizaciones: localizaciones,
                juego: play.json.item?.id,
                jugadores: play.json.players?.map(player => {
                    let id = player.userid > 0 ? player.userid : `${play.reporter}_${player.name.toLowerCase().replaceAll(" ", "_")}`
                    return players[id].mapTo ?? players[id].id
                })
            }
        });
    },
    arrayToObject: (arrayToMap, field = "id") => {
        return arrayToMap.reduce((acc, item) => {
            acc[item[field]] = item;
            return acc;
        }, {})
    },
    ensureDB: async function () {
        if (!this.db) await this.init();
    },
    savePartida: async function (play) {
        let result = await this.run(`INSERT OR IGNORE INTO partidas (id, fecha, reportador, juego, jugadores, localizaciones) VALUES (?, ?, ?, ?, ?, ?)`, [play.id, play.fecha, play.reportador, play.juego, JSON.stringify(play.jugadores), JSON.stringify(play.localizaciones)]);
        return result[0];
    },
    getPartida: async function (id) {
        let result = await this.get(`SELECT * FROM partidas WHERE id = ?`, [id]);
        return {
            ...result,
            localizaciones: JSON.parse(result.localizaciones),
            juego: result.juego,
            jugadores: JSON.parse(result.jugadores),
        }
    },
    saveJuegos: async function (juegos) {
        await juegos.map(async juego => await this.saveJuego(juego))
    },
    saveJuego: async function (juego) {
        let result = await this.run(`INSERT OR IGNORE INTO juegos (id, name, image, thumbnail, weight, playingtime, minplaytime, maxplaytime, minage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [juego.id, juego.name, juego.image, juego.thumbnail, juego.weight, juego.playingtime, juego.minplaytime, juego.maxplaytime, juego.minage]);
        return result[0];
    },
    getJuegos: async function () {
        let result = await this.all(`SELECT * FROM juegos`);
        return result
    },
    getJuego: async function (id) {
        let result = await this.get(`SELECT * FROM juegos WHERE id = ?`, [id]);
        //console.log(result)
        return {
            ...result,
        }
    },
    saveJugadores: async function (jugadores) {
        await jugadores.map(async jugador => await this.saveJugador(jugador))
    },
    saveJugador: async function (jugador) {
        let result = await this.run(`INSERT OR IGNORE INTO jugadores (id, name, nick, image, bgg, yearregistered, lastlogin, mapTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [jugador.id, jugador.name, jugador.nick, jugador.image, jugador.bgg, jugador.yearregistered, jugador.lastlogin, jugador.mapTo]);
        return result[0];
    },
    getJugador: async function (id) {
        let result = await this.get(`SELECT * FROM jugadores WHERE id = ?`, [id]);
        //console.log(result)
        return {
            ...result,
        }
    },
    getJugadores: async function () {
        let jugadores =  await this.all(`SELECT * FROM jugadores`);
        return jugadores
    },
    all: async function (sql, params = []) {
        await this.ensureDB()
        return await new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    run: async function (sql, params = []) {
        await this.ensureDB();
        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ success: true, changes: this.changes }); // Incluye información sobre cambios
            });
        });
    },
    get: async function (sql, params = []) {
        await this.ensureDB();
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    delete: async function (tabla) {
        return await this.run(`DELETE FROM ${tabla}`);
    },
    init: async function () {
        this.db = new sqlite3.Database(this.basePath + this.path);
        let db = this.db;
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS partidas (
                id TEXT PRIMARY KEY,
                fecha TEXT,
                reportador TEXT,
                juego TEXT,
                jugadores TEXT,
                localizaciones TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS jugadores (
                id TEXT PRIMARY KEY,
                name TEXT,
                nick TEXT,
                bgg TEXT,
                image TEXT,
                yearregistered TEXT,
                lastlogin TEXT,
                mapTo TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS juegos (
                id TEXT PRIMARY KEY,
                name TEXT,
                image TEXT,
                thumbnail TEXT,
                weight TEXT,
                playingtime TEXT,
                minplaytime TEXT,
                maxplaytime TEXT,
                minage TEXT
            )`);
        })

        return db

    }
})