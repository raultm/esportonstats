import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizedDBBuilder } from '../../src/node/nomalizedDB.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BGG } from '../../src/node/bgg.js';
import { normalizedDB } from '../../src/node/nomalizedDB.js';
import { rawDBBuilder } from '../../src/node/rawDB.js';
import { gamesFixture, locationsFixture, playersFixture, playsFixture } from '../fixtures/rawDB_01_data.js';

describe('normalizeDB', () => {
    describe('Configuración', () => {
        it('por defecto la ruta del archivo sqlite es {root}/data/normalized.test.sqlite', async () => {
            let normalizedDB = await normalizedDBBuilder();
            expect(normalizedDB.path).toBe("/data/esporton.test.sqlite")
        })
    });

    it('tras inicializar tenemos 1 tabla', async () => {
        let tables = await normalizedDBBuilder().all("SELECT name FROM sqlite_master WHERE type='table'")
        expect(tables.length).toBe(3)
    })

    it('puedo guardar una partida', async () => {
        let db = normalizedDBBuilder();
        await db.delete('partidas')

        await db.savePartida({
            id: '20132015',
            fecha: '2013-09-25',
            reportador: 'raultm',
            localizaciones: ['Almendralejo', 'Badajoz'],
            juego: '123456',
            jugadores: []
        });
        let partida = await db.getPartida('20132015');
        //console.log(partida)

        expect(typeof partida).toBe("object");
        expect(partida.id).toBe('20132015');
        expect(partida.fecha).toBe('2013-09-25');
        expect(partida.reportador).toBe('raultm');
        expect(partida.juego).toBe('123456');
        expect(partida.localizaciones[0]).toBe('Almendralejo');
        expect(partida.jugadores.length).toBe(0);
    })

    it('puedo guardar un juego', async () => {
        let db = normalizedDBBuilder();
        await db.delete('juegos')

        await db.saveJuego({
            id: '352515',
            name: 'Trio',
            image: 'https://cf.geekdo-images.com/d9F0ZDqcN3J7J92WckyraQ__original/img/3OAIArHm3Z_j5bAJeJlU5LKQie0=/0x0/filters:format(jpeg)/pic7605785.jpg',
            thumbnail: 'https://cf.geekdo-images.com/d9F0ZDqcN3J7J92WckyraQ__thumb/img/8d663Cj-RQy8pA8gZOcO80xYI5I=/fit-in/200x150/filters:strip_icc()/pic7605785.jpg',
            weight: '1.0364',
            playingtime: '15',
            minplayingtime: '15',
            maxplayingtime: '15',
            minage: '6',
        });
        let juego = await db.getJuego('352515');
        //console.log(juego)

        expect(typeof juego).toBe("object");
        expect(juego.id).toBe('352515');
        expect(juego.name).toBe('Trio');
        expect(juego.minage).toBe('6');
        
    })

    it('puedo guardar un jugador', async () => {
        let db = normalizedDBBuilder();
        await db.delete('jugadores')

        await db.saveJugador({
            id: '1234',
            name: 'Luis Aragones',
            nick: 'elsabiodehortaleza',
            image: 'avatar.jpg',
            bgg: '1',
            yearregistered: '2013',
            lastlogin: '2024-12-12',
            mapTo: '',
        });
        let juego = await db.getJugador('1234');
        //console.log(juego)

        expect(typeof juego).toBe("object");
        expect(juego.id).toBe('1234');
        expect(juego.nick).toBe('elsabiodehortaleza');
        expect(juego.lastlogin).toBe('2024-12-12');
        
    })

    describe("accion de normalizar", function () {

        it("si le paso una rawDB consulta los datos de partidas, jugadores, localizaciones, y juegos", async() => {
            const rawDB = {
                getPlays: vi.fn().mockResolvedValue(playsFixture),
                getPlayers: vi.fn().mockResolvedValue(playersFixture),
                getLocations: vi.fn().mockResolvedValue(locationsFixture),
                getGames: vi.fn().mockResolvedValue(gamesFixture),
                getPlaysWithoutDuplicates: vi.fn().mockResolvedValue(playsFixture)
            };
            let db = normalizedDBBuilder();

            let data = await db.normalizeData(rawDB)
            let jugadores = await db.getJugadores()
            // console.log(jugadores)
            let juegos = await db.getJuegos()

            expect(rawDB.getPlaysWithoutDuplicates).toHaveBeenCalled();
            expect(rawDB.getPlayers).toHaveBeenCalled();
            expect(rawDB.getLocations).toHaveBeenCalled();
            expect(rawDB.getGames).toHaveBeenCalled();
            expect(rawDB.getPlaysWithoutDuplicates).toHaveBeenCalled();
            
            //console.log(data)
            expect(data.length).toBe(1)
            expect(jugadores.length).toBeGreaterThan(0)
            expect(juegos.length).toBeGreaterThan(0)
            expect(data[0].id).toBe('91306729')
            expect(data[0].fecha).toBe('2024-11-16')
            expect(data[0].reportador).toBe('raultm')
            expect(data[0].localizaciones).toEqual([ 'Almendralejo Normalizado', 'Badajoz Normalizado' ])
            expect(data[0].juego).toEqual("352515")
            // usuarios anonimos traducidos a ''
            expect(data[0].jugadores).toEqual([
                '',
                '',
                '',
                '',
                '',
                ''
              ])
        })

    })

});

