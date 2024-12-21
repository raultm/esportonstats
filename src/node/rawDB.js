import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

export const rawDBBuilder = (config) => ({
    basePath: config?.path == ":memory:"? "" :path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
    path: config?.path ?? "/data/bgg.test.sqlite",
    db: null,
    ensureDB: async function () {
        if (!this.db) 
            await this.init();
    },
    markUserAsProcessed: async function (username, date) {
        let result = await this.run(`INSERT INTO last_processed (username, last_date) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET last_date = excluded.last_date`, [username, date]);
        return result[0];
    },
    getLastProcessed: async function (username) {
        let result = await this.get(`SELECT last_date FROM last_processed WHERE username = ?`, [username]);
        return result?.last_date;
    },
    saveData: async function (data) {
        let result = await this.savePlays(data.reporter, data.plays)
        await this.saveGames(data.games)
        await this.savePlayers(data.reporter, data.players)
        await this.saveLocations(data.reporter, data.locations)

    },
    savePlays: async function (reporter, plays) {
        // Usamos Promise.all para guardar las partidas concurrentemente
        return await Promise.all(
            plays.map((play) => this.savePlay(reporter, play))
        );
    },
    savePlay: async function (reporter, play) {
        let result = await this.run(`INSERT OR IGNORE INTO plays (id, reporter, date, game, json) VALUES (?, ?, ?, ?, ?)`, [play.id, reporter, play.date, play.item.name, JSON.stringify(play)]);
        return result[0];
    },
    getPlay: async function (id) {
        let result = await this.get(`SELECT * FROM plays WHERE id = ?`, [id]);
        return result;
    },
    getPlays: async function () {
        return await this.all(`SELECT * FROM plays`);
    },
    getPlaysWithoutDuplicates: async function () {
        return await this.all(`SELECT * FROM plays WHERE duplicate IS NULL`);
    },
    saveGames: async function (games) {
        await Promise.all(
            games.map((game) => this.saveGame(game))
        );
    },
    saveGame: async function (game) {
        let result = await this.run(`INSERT OR IGNORE INTO games (id, name) VALUES (?, ?)`, [game.id, game.name]);
        return result[0];
    },
    updateGames: async function (games) {
        await Promise.all(
            games.map((game) => this.updateGame(game))
        );
    },
    updateGame: async function (game) {
        let result = await this.run(`UPDATE games SET image = ?, thumbnail = ?, weight = ?, playingtime = ?, minplaytime = ?, maxplaytime = ?, minage = ? WHERE id = ?`, [game.image, game.thumbnail, game.weight, game.playingtime, game.minplaytime, game.maxplaytime, game.minage, game.id]);
        return result[0];
    },
    updatePlayers: async function (players) {
        await Promise.all(
            players.map((player) => this.updatePlayer(player))
        );
    },
    updatePlayer: async function (player) {
        let result = await this.run(`UPDATE players SET image = ?, yearregistered = ?, lastlogin = ? WHERE id = ?`, [player.image, player.yearregistered, player.lastlogin, player.id]);
        return result[0];
    },
    getGame: async function (id) {
        let result = await this.get(`SELECT * FROM games WHERE id = ?`, [id]);
        return result;
    },
    getGames: async function () {
        return await this.all(`SELECT * FROM games`);
    },
    saveLocations: async function (reporter, locations) {
        await Promise.all(
            locations.map((location) => this.saveLocation(reporter, location))
        );
    },
    saveLocation: async function (reporter, location) {
        location.name
            .split(',')
            .map(location => location.trim())
            .map(async location => {
                let id = reporter + "_" + location.toLowerCase().replaceAll(" ", "_");
                let baseId = "esporton_" + location.toLowerCase().replaceAll(" ", "_");
                await this.run(`INSERT OR IGNORE INTO locations (id, name, mapTo) VALUES (?, ?, ?)`, [id, location, baseId]);
                await this.run(`INSERT OR IGNORE INTO locations (id, name, mapTo) VALUES (?, ?, ?)`, [baseId, location, '']);
            })
        return [];
    },
    getLocation: async function (id) {
        let result = await this.get(`SELECT * FROM locations WHERE id = ?`, [id]);
        return result;
    },
    getLocations: async function () {
        return await this.all(`SELECT * FROM locations`)
    },
    savePlayers: async function (reporter, players) {
        // Usamos Promise.all para guardar los jugadores concurrentemente
        await Promise.all(
            players.map((player) => this.savePlayer(reporter, player))
        );
    },
    savePlayer: async function (reporter, player) {
        let bgg = player.userid > 0 
        let id = bgg ? player.userid : reporter + "_" + player.name.toLowerCase().replaceAll(" ", "_");
        let result = await this.run(`INSERT OR IGNORE INTO players (id, name, nick, bgg, mapTo) VALUES (?, ?, ?, ?, ?)`, [id, player.name, player.username, bgg, player.mapTo]);
        return result[0];
    },
    getPlayer: async function (id) {
        let result = await this.get(`SELECT * FROM players WHERE id = ?`, [id]);
        return result;
    },
    getPlayers: async function () {
        return await this.all(`SELECT * FROM players`)
    },
    getUsersToComplete: async function () {
        return await this.all(`SELECT * FROM players WHERE bgg=1 AND image IS NULL`)
    },
    getGamesToComplete: async function () {
        return await this.all(`SELECT * FROM games WHERE image IS NULL`)
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
    clean: async function () {
        await this.run(`DELETE FROM last_processed`);
        await this.run(`DELETE FROM plays`);
        await this.run(`DELETE FROM games`);
        await this.run(`DELETE FROM players`);
        await this.run(`DELETE FROM locations`);
    },
    init: async function () {
        this.db = new sqlite3.Database(this.basePath + this.path);
        let db = this.db;
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS last_processed (
                username TEXT PRIMARY KEY,
                last_date TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS plays (
                id TEXT PRIMARY KEY,
                date TEXT,
                reporter TEXT,
                game TEXT,
                duplicate TEXT,
                json TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                name TEXT,
                nick TEXT,
                bgg TEXT,
                image TEXT,
                yearregistered TEXT,
                lastlogin TEXT,
                mapTo TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS games (
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
            db.run(`CREATE TABLE IF NOT EXISTS locations (
                id TEXT PRIMARY KEY,
                name TEXT,
                mapTo TEXT
            )`);
        })

        return db

    }
})