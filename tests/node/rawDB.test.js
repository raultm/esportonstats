import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rawDBBuilder } from '../../src/node/rawDB.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BGG } from '../../src/node/bgg.js';
import exp from 'constants';
import { gamesFixture, playsFixture, locationsFixture, playersFixture } from '../fixtures/rawDB_01_data.js';

describe('rawDB', () => {

    let rawDB

    beforeEach(async () => {
        rawDB = rawDBBuilder({path: ":memory:"})
        //rawDB = rawDBBuilder()
        await rawDB.clean()
    });

    describe('Configuración', () => {
        it('por defecto la ruta del archivo sqlite es {root}/data/bgg.sqlite', async () => {
            let rawDB = rawDBBuilder()
            expect(rawDB.path).toBe("/data/bgg.test.sqlite")
        })
    });

    it('tras inicializar tenemos 5 tablas', async () => {
        let rawDB = rawDBBuilder()
        let tables = await rawDB.all("SELECT name FROM sqlite_master WHERE type='table'")
        expect(tables.length).toBe(5)
    })

    describe("guardamos datos tras analizar partidas de jugador", () => {

        beforeAll(() => {
            const fixtures = {
                "raultm": [readFileSync(join(__dirname, '../fixtures/plays_raultm.xml'), 'utf8')],
                "corion": [
                    readFileSync(join(__dirname, '../fixtures/plays_corion_1.xml'), 'utf8'),
                    readFileSync(join(__dirname, '../fixtures/plays_corion_2.xml'), 'utf8')
                ],
                "games":{
                    "244521":readFileSync(join(__dirname, '../fixtures/game_pocimas_y_brebajes.xml'), 'utf8'),
                }
            }
            global.fetch = vi.fn((url) => {
                const parsedUrl = new URL(url);
                //console.log(parsedUrl.href)
                if(parsedUrl.href.includes('/plays') ){
                    const urlParams = new URLSearchParams(parsedUrl.searchParams);
                    const reporter = urlParams.get('username') ?? "raultm"
                    const page = urlParams.get('page') ?? 1
                    return Promise.resolve({ ok: true, text: () => Promise.resolve(fixtures[reporter][page-1]) })
                }
                if(parsedUrl.href.includes('/thing') ){
                    const urlParams = new URLSearchParams(parsedUrl.searchParams);
                    const id = urlParams.get('id') ?? "244521"
                    let defaultGame = readFileSync(join(__dirname, '../fixtures/game_pocimas_y_brebajes.xml'), 'utf8').replaceAll("244521", id)
                    return Promise.resolve({ ok: true, text: () => Promise.resolve(fixtures["games"][id]??defaultGame) })
                }
                if(parsedUrl.href.includes('/user') ){
                    const urlParams = new URLSearchParams(parsedUrl.searchParams);
                    const name = urlParams.get('name') ?? "raultm"
                    let defaultUser = readFileSync(join(__dirname, '../fixtures/user_corion.xml'), 'utf8').replaceAll("corion", name)
                    return Promise.resolve({ ok: true, text: () => Promise.resolve(fixtures["games"][name]??defaultUser) })
                }
                return Promise.resolve({ ok: true, text: () => Promise.resolve("<vacio></vacio>") })
            });
        });

        afterAll(() => {
            vi.restoreAllMocks(); 
        });

        it('datos de raultm', async () => {
            let dataJs = await BGG.fetchPlays('raultm')
            let dataToStore = BGG.analyzePlays("raultm", dataJs);
            await rawDB.saveData(dataToStore)
            expect( (await rawDB.getPlays()).length).toBe(3)
        })

        it('tras guardar datos podemos consultar jugadores que no tienen toda la info', async () => {
            let dataJs = await BGG.fetchPlays('corion')
            let dataToStore = BGG.analyzePlays("corion", dataJs);
            await rawDB.saveData(dataToStore)
            expect( (await rawDB.getUsersToComplete()).length).toBe(2)
        })

        it('tras guardar datos podemos consultar juegos que no tienen toda la info', async () => {
            let dataJs = await BGG.fetchPlays('corion')
            let dataToStore = BGG.analyzePlays("corion", dataJs);
            await rawDB.saveData(dataToStore)
            expect( (await rawDB.getGamesToComplete()).length).toBe(6)
        })

        it('datos de corion', async () => {
            let reporter = "corion";
            let dataToStore = BGG.analyzePlays(reporter, await BGG.fetchPlays(reporter));
            await rawDB.saveData(dataToStore)
        })

        it('datos de juegos tras partidas', async () => {
            let reporter = "corion";
            let dataToStore = BGG.analyzePlays(reporter, await BGG.fetchPlays(reporter));
            await rawDB.saveData(dataToStore)

            let gamesToComplete = await rawDB.getGamesToComplete();
            expect( gamesToComplete.length).toBe(6)
            
            let gamesWithFullInfo = await gamesToComplete.map(async game => await BGG.fetchGame(game.id))
            let promises = await Promise.all(gamesWithFullInfo)
            
            await rawDB.updateGames(promises)
            gamesToComplete = await rawDB.getGamesToComplete();
            expect( gamesToComplete.length).toBe(0)
        })

        it('datos de jugadores tras partidas', async () => {
            let reporter = "corion";
            let dataToStore = BGG.analyzePlays(reporter, await BGG.fetchPlays(reporter));
            await rawDB.saveData(dataToStore)

            let toComplete = await rawDB.getUsersToComplete();
            expect( toComplete.length).toBe(2)
            
            let withFullInfo = await toComplete.map(async user => await BGG.fetchUser(user.id))
            let promises = await Promise.all(withFullInfo)
            
            await rawDB.updatePlayers(promises)
            toComplete = await rawDB.getUsersToComplete();
            expect( toComplete.length).toBe(1)
        })

    })

    

    describe("probamos fechas de procesamiento de usuarios", () => {
        
        beforeEach(async () => {
            await rawDB.run(`DELETE FROM last_processed`);
        })
        
        it('puedo consultar dato de ultimo procesamiento de usuario raultm', async () => {  
            await rawDB.markUserAsProcessed("raultm", "2024-11-22");
            let lastDate = await rawDB.getLastProcessed('raultm');
            expect(lastDate).toBe('2024-11-22')
        })
    
        it('si tenia una fecha de procesamiento y la actualizo, lo hace sin problemas', async () => {  
            await rawDB.markUserAsProcessed("raultm", "2024-11-22");
            expect(await rawDB.getLastProcessed('raultm')).toBe('2024-11-22');
    
            await rawDB.markUserAsProcessed("raultm", "2024-11-30");
            expect(await rawDB.getLastProcessed('raultm')).toBe('2024-11-30');
        })
    })

    it('puedo guardar una partida', async () => {
        await rawDB.savePlay('raultm', {
            id: '91523256',
            date: '2024-11-22',
            quantity: '1',
            length: '0',
            incomplete: '0',
            nowinstats: '0',
            location: 'Almendralejo, Badajoz, Spain',
            item: { id: '352515', name: 'Trio' },
            players: [1,2] 
          });
        let play = await rawDB.getPlay('91523256');
        
        expect(typeof play).toBe("object");
        expect(play.id).toBe('91523256');
        expect(play.date).toBe('2024-11-22');
        expect(play.reporter).toBe('raultm');
        expect(play.game).toBe('Trio');
    })

    it('puedo guardar un juego', async () => {
        await rawDB.saveGame({ id: '352515', name: 'Trio' });
        let game = await rawDB.getGame('352515');
        
        expect(typeof game).toBe("object");
        expect(game.id).toBe('352515');
        expect(game.name).toBe('Trio');
    })

    it('actualizacion de juego', async () => {
        await rawDB.saveGame({ id: '352515', name: 'Trio' });
        let game = await rawDB.getGame('352515');
        
        expect(typeof game).toBe("object");
        expect(game.id).toBe('352515');
        expect(game.name).toBe('Trio');

        await rawDB.updateGame({ id: '352515', name: 'Trio', image: 'image.png', thumbnail: 'thumbnail.png', weight: '1.0364', playingtime: '15', minplaytime: '15', maxplaytime: '15', minage: '6' })
        game = await rawDB.getGame('352515');
        
        expect(typeof game).toBe("object");
        expect(game.id).toBe('352515');
        expect(game.name).toBe('Trio');
        expect(game.image).toBe('image.png');
        expect(game.thumbnail).toBe('thumbnail.png');
        expect(game.weight).toBe('1.0364');
        expect(game.playingtime).toBe('15');
        expect(game.minplaytime).toBe('15');
        expect(game.maxplaytime).toBe('15');
        expect(game.minage).toBe('6');
    })

    it('actualizacion de juegos', async () => {
        await rawDB.saveGame({ id: '352515', name: 'Trio' });
        await rawDB.saveGame({ id: '352516', name: 'Trio2' });
        let games = await rawDB.getGames();
        
        expect(typeof games).toBe("object");
        expect(games.length).toBe(2);

        await rawDB.updateGames([
            { id: '352515', name: 'Trio', image: 'image.png', thumbnail: 'thumbnail.png', weight: '1.0364', playingtime: '15', minplaytime: '15', maxplaytime: '15', minage: '6' }, 
            { id: '352516', name: 'Trio2', image: 'image2.png', thumbnail: 'thumbnail2.png', weight: '1.0364', playingtime: '15', minplaytime: '15', maxplaytime: '15', minage: '6' }
        ])
        games = await rawDB.getGames();
        
        expect((await rawDB.getGamesToComplete()).length).toBe(0)
    })

    it('puedo guardar una localizacion juego', async () => {
        await rawDB.saveLocation('raultm', { name: 'Almendralejo' });
        let location = await rawDB.getLocation('raultm_almendralejo');
        let locationBase = await rawDB.getLocation('esporton_almendralejo');
        
        expect(typeof location).toBe("object");
        expect(location.id).toBe('raultm_almendralejo');
        expect(location.name).toBe('Almendralejo');
        expect(location.mapTo).toBe('esporton_almendralejo');

        expect(locationBase.id).toBe('esporton_almendralejo');
        expect(locationBase.name).toBe('Almendralejo');
    })

    it('puedo guardar varias localizaciones si hay varias cosas separadas por comas', async () => {
        await rawDB.saveLocation('raultm', { name: 'Almendralejo, Badajoz' });
        let locationAlmendralejo = await rawDB.getLocation('raultm_almendralejo');
        let locationBadajoz = await rawDB.getLocation('raultm_badajoz');
        let locationBase = await rawDB.getLocation('esporton_almendralejo');
        
        expect(locationAlmendralejo.id).toBe('raultm_almendralejo');
        expect(locationAlmendralejo.name).toBe('Almendralejo');
        expect(locationAlmendralejo.mapTo).toBe('esporton_almendralejo');

        expect(locationBadajoz.id).toBe('raultm_badajoz');
        expect(locationBadajoz.name).toBe('Badajoz');
        expect(locationBadajoz.mapTo).toBe('esporton_badajoz');
    })

    it('puedo guardar un jugador que no tiene ID BGG', async () => {
        await rawDB.savePlayer('corion', { username: '', userid: '0', name: 'Raúl Tierno' },);
        let game = await rawDB.getPlayer('corion_raúl_tierno');
        
        expect(typeof game).toBe("object");
        expect(game.id).toBe('corion_raúl_tierno');
        expect(game.name).toBe('Raúl Tierno');
        expect(game.nick).toBe('');
        expect(game.bgg).toBe("0");
        expect(game.mapTo).toBe(null);
    })

    it('puedo guardar un jugador que tiene ID BGG', async () => {
        await rawDB.savePlayer('corion', { username: 'corion', userid: '1604925', name: 'Juan Carlos Villanueva' });
        let game = await rawDB.getPlayer('1604925');
        
        expect(typeof game).toBe("object");
        expect(game.id).toBe('1604925');
        expect(game.name).toBe('Juan Carlos Villanueva');
        expect(game.nick).toBe('corion');
        expect(game.bgg).toBe("1");
        expect(game.mapTo).toBe(null);
    })

    it('se pueden consultar todas las partidas', async () => {
        await rawDB.savePlay("prueba", playsFixture[0])
        let plays = await rawDB.getPlays();
        expect(plays.length).toBeGreaterThan(0)
    })

    it('se pueden consultar todos los juegos', async () => {
        await rawDB.saveGame(gamesFixture[0])
        let games = await rawDB.getGames();
        expect(games.length).toBeGreaterThan(0)
    })

    it('se pueden consultar todas las localizaciones', async () => {
        await rawDB.saveLocation("probando", locationsFixture[0])
        let locations = await rawDB.getLocations();
        expect(locations.length).toBeGreaterThan(0)
    })

    it('se pueden consultar todos los jugadores', async () => {
        await rawDB.savePlayer("probando", playersFixture[0])
        let players = await rawDB.getPlayers();
        expect(players.length).toBeGreaterThan(0)
    })

});

