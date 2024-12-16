import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BGG } from '../../src/node/bgg.js';
import { log } from 'console';

describe('bgg', () => {
    describe('Configuración', () => {
        it('la ruta base de los endpoints debe ser correcta', async () => {
            expect(BGG.BASE_ENDPOINT).toBe("https://boardgamegeek.com/xmlapi2/");
        })
    });

    describe('obtener datos de reportador. Datos mockeados)', () => {

        beforeAll(() => {
            const fixtures = {
                "raultm": [readFileSync(join(__dirname, '../fixtures/plays_raultm.xml'), 'utf8')],
                "corion": [
                    readFileSync(join(__dirname, '../fixtures/plays_corion_1.xml'), 'utf8'),
                    readFileSync(join(__dirname, '../fixtures/plays_corion_2.xml'), 'utf8')
                ]
            }
            global.fetch = vi.fn((url) => {
                const parsedUrl = new URL(url);
                const urlParams = new URLSearchParams(parsedUrl.searchParams);
                const reporter = urlParams.get('username') ?? "asd"
                const page = urlParams.get('page') ?? 1
                return Promise.resolve({ ok: true, text: () => Promise.resolve(fixtures[reporter][page-1]) })
            });
        });

        afterAll(() => {
            vi.restoreAllMocks(); 
        });

        it('al hacer petición a fetch y parsear no hay problemas', async () => {
            let fetchResponse = await fetch("https://boardgamegeek.com/xmlapi2/plays?username=raultm");
            let playsJs = BGG.xml2js(await fetchResponse.text())
            expect(typeof playsJs).toBe("object")
            expect(playsJs.plays.play.length).toBe(3)
        })

        it('al obtener partidas con fetchPlays gestiona bien el tema de UNA PAGINA reporter1', async () => {
            let fetchedGames = await BGG.fetchPlays('raultm');
            expect(fetchedGames.length).toBe(3);
        })

        it('al obtener partidas con fetchPlays gestiona bien el tema de VARIAS PAGINAS reporter2', async () => {
            // https://boardgamegeek.com/xmlapi2/plays?username=corion&mindate=2024-01-01
            let fetchedGames = await BGG.fetchPlays('corion');
            expect(fetchedGames.length).toBe(6);
        })

        it('al obtener partidas de "raultm" con fetchPlays podemos analizar los datos para sacar juegos y jugadores', async () => {
            let fetchedGames = await BGG.fetchPlays('raultm');
            let dataToStore = BGG.analyzePlays("raultm", fetchedGames);
            
            expect(dataToStore.plays.length).toBe(3);
            expect(dataToStore.games.length).toBe(2);
            expect(dataToStore.players.length).toBe(3); // corion, raulm, anonimo
            expect(dataToStore.locations.length).toBe(2);
        })

        it('al obtener partidas de "corion" con fetchPlays podemos analizar los datos para sacar juegos y jugadores', async () => {
            let fetchedGames = await BGG.fetchPlays('corion');
            let dataToStore = BGG.analyzePlays("corion", fetchedGames);
            
            expect(dataToStore.plays.length).toBe(6);
            expect(dataToStore.games.length).toBe(6);
            expect(dataToStore.players.length).toBe(8);
            expect(dataToStore.locations.length).toBe(1);
        })
    });

    describe('obtener datos de un juego', () => {

        beforeAll(() => {
            const fixtures = {
                "352515": readFileSync(join(__dirname, '../fixtures/game_trio.xml'), 'utf8'),
                
            }
            global.fetch = vi.fn((url) => {
                const parsedUrl = new URL(url);
                const urlParams = new URLSearchParams(parsedUrl.searchParams);
                const gameId = urlParams.get('id') ?? "0"
                return Promise.resolve({ ok: true, text: () => Promise.resolve(fixtures[gameId]) })
            });
        });

        afterAll(() => {
            vi.restoreAllMocks(); 
        });

        it('consultar juego y toda su info por id', async () => {
            let game = await BGG.fetchGame('352515');
            expect(game.id).toBe("352515");
            expect(game.name).toBe("Trio");
            expect(game.weight).toBe("1.0364");
            expect(game.image).toBe("https://cf.geekdo-images.com/d9F0ZDqcN3J7J92WckyraQ__original/img/3OAIArHm3Z_j5bAJeJlU5LKQie0=/0x0/filters:format(jpeg)/pic7605785.jpg");
            expect(game.thumbnail).toBe("https://cf.geekdo-images.com/d9F0ZDqcN3J7J92WckyraQ__thumb/img/8d663Cj-RQy8pA8gZOcO80xYI5I=/fit-in/200x150/filters:strip_icc()/pic7605785.jpg");
            expect(game.playingtime ).toBe("15");
            expect(game.minplaytime ).toBe("15");
            expect(game.maxplaytime ).toBe("15");
            expect(game.minage ).toBe("6");
        })
    });

    describe('obtener datos de un juego', () => {

        beforeAll(() => {
            const fixtures = {
                "corion": readFileSync(join(__dirname, '../fixtures/user_corion.xml'), 'utf8'),
                
            }
            global.fetch = vi.fn((url) => {
                const parsedUrl = new URL(url);
                const urlParams = new URLSearchParams(parsedUrl.searchParams);
                const gameId = urlParams.get('name') ?? "corion"
                return Promise.resolve({ ok: true, text: () => Promise.resolve(fixtures[gameId]) })
            });
        });

        afterAll(() => {
            vi.restoreAllMocks(); 
        });

        it('consultar datos de jugador por name', async () => {
            let user = await BGG.fetchUser('corion')
            expect(user.id).toBe("1604925")
            expect(user.nick).toBe("corion")
            expect(user.name).toBe("Juan Carlos Villanueva")
            expect(user.image).toBe("https://cf.geekdo-static.com/avatars/avatar_id134148.png")
            expect(user.yearregistered).toBe("2017")
            expect(user.lastlogin).toBe("2024-12-08")
            
        })
    });
});

