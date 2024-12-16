import dotenv from "dotenv";
import { rawDBBuilder } from './rawDB.js';
import { BGG } from "./bgg.js";
import { normalizedDBBuilder } from "./nomalizedDB.js";

dotenv.config();

const users = process.env.USERS ? process.env.USERS.split(",") : []
const ENV_MINDATE = process.env.MINDATE ?? ""

async function main() {
    const usernames = users
    console.log(usernames, ENV_MINDATE)
    const db = rawDBBuilder({path:"/data/bgg.sqlite"})

    for (const username of usernames) {
        let since = await db.getLastProcessed(username) ?? null;
        since = since ?? ENV_MINDATE;
        console.log([username, since])
        const data = await BGG.analyzePlays(username, await BGG.fetchPlays(username, since));
        if (data.plays.length > 0) {
            console.log(`Fetched ${data.plays.length} plays for ${username} since ${since}`);
            await db.saveData(data)
            const lastDate = data.plays[0].date
            const nextDate = addOneDay(lastDate)
            await db.markUserAsProcessed(username, nextDate)


        } else {
            console.log(`No new plays for ${username}`)
        }
        console.log(`Updating games and players`)
        let games = await db.getGamesToComplete()
        console.log("Juegos sin datos :", games.length)
        await processGamesInBatches(games, 2, db)
        
        let users = await db.getUsersToComplete()
        console.log("Usuarios Bgg sin datos :", users.length)
        await processUsersInBatches(users, 2, db)
    }

    // db.close();
}

async function processGamesInBatches(items, BATCH_SIZE, db) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        let batch = items.slice(i, i + BATCH_SIZE);
        const ids = batch.map(item => item.id)
        console.log(`Fetching data for batch ${i / BATCH_SIZE + 1}: ${ids.join(',')}`);
        await processBatchJuegos(db, ids);
        await wait(500)
    }
}

async function processUsersInBatches(items, BATCH_SIZE, db) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        let batch = items.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch: ${i / BATCH_SIZE + 1}`);
        await processBatchJugadores(db, batch);
        await wait(500)
    }
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processBatchJuegos(db, ids) {
    const gamesWithBggInfo = await BGG.fetchGames(ids); // Solicitar juegos por lote
    await db.updateGames(gamesWithBggInfo);
}

async function processBatchJugadores(db, users) {
    let batchPromises = users.map(async (user) => await BGG.fetchUser(user.nick));
    let batchResults = await Promise.all(batchPromises);
    await db.updatePlayers(batchResults);
    
}

function addOneDay(dateString) {
    const date = new Date(dateString); // Convertimos la cadena en un objeto Date
    date.setDate(date.getDate() + 1); // Añadimos un día
    return date.toISOString().split('T')[0]; // Convertimos de nuevo a formato YYYY-MM-DD
}
async function normalize() {
    const rawDB = rawDBBuilder({path:"/data/bgg.sqlite"})
    const db = normalizedDBBuilder({path:"/data/esporton.sqlite"})
    await db.delete('partidas')
    await db.delete('jugadores')
    await db.delete('juegos')
    const partidas = await db.normalizeData(rawDB)
    partidas.map(partida => db.savePartida(partida))

}

console.log("Obteniendo partidas de BGG")
await main().catch(console.error)
console.log("Normalizando")
await normalize().catch(console.error)