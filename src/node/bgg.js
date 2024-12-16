import xml2json from "xml-js";
const env = process.env.NODE_ENV
const showLogs = env!="test"
export const BGG = {
    BASE_ENDPOINT: 'https://boardgamegeek.com/xmlapi2/',
    fetchAPI: async (entity, params) => {
        const queryString = new URLSearchParams(params).toString();
        let url = `${BGG.BASE_ENDPOINT}${entity}?${queryString}`
        if(showLogs) console.log(url)
        const response = await fetch(url);
        let responseBody = await response.text()
        if(showLogs) console.log(responseBody.split("\n")[0])
        return BGG.xml2js(responseBody.replaceAll("&", "and"))
    },
    fetchPlays: async (username, since) => {
        const plays = [];
        let page = 1;
        let mindate = since
        let data = await BGG.fetchAPI(`plays`, { username, page,mindate })
        if(data.plays["_attributes"].total == 0){
            return []
        }
        plays.push(...BGG.parseBggPlays(data))
        while (data.plays["_attributes"].total > (page * 100)) {
            page += 1
            data = await BGG.fetchAPI(`plays`, { username, page, mindate })
            plays.push(...BGG.parseBggPlays(data));
        }
        return plays
    },
    analyzePlays: (reporter, plays) => {
        return {
            reporter: reporter,
            plays: plays,
            games: [...new Set(plays.map(play => JSON.stringify(play.item)))].map(game => JSON.parse(game)),
            players: [...new Set(plays.flatMap(play => play.players.map(({username, userid, name}) => JSON.stringify({username, userid, name}))))].map(player => JSON.parse(player)),
            locations: [...new Set(plays.map(play => JSON.stringify({name:play.location})))].map(location => JSON.parse(location))
        }
    },
    fetchGames: async (ids) => {
        // Convierte los IDs en una lista separada por comas, como lo requiere la API
        const idParam = Array.isArray(ids) ? ids.join(',') : ids;
        const game = await BGG.fetchAPI(`thing`, { id: idParam, stats: 1 });
    
        // Asegurarse de que el resultado sea siempre un array
        const items = Array.isArray(game.items.item) ? game.items.item : [game.items.item];
        
        return items.map(item => {
            // Manejar nombres no estandarizados
            if (!Array.isArray(item.name)) {
                item.name = [item.name];
            }
            return BGG.parseBggGame(item);
        });
    },
    fetchGame: async (id) => {
        const game = await BGG.fetchAPI(`thing`, { id, stats: 1 });
        if(!Array.isArray(game.items.item.name)){
            game.items.item.name = [game.items.item.name]
        }
        return BGG.parseBggGame(game.items.item)
    },
    fetchUser: async (name) => {
        const user = await BGG.fetchAPI(`user`, { name });
        return BGG.parseBggUser(user.user)
    },
    xml2js: (xml) => xml2json.xml2js(xml, { compact: true, spaces: 4 }),
    parseBggPlays: playsBggJs => {
        console.log(playsBggJs)
        if(typeof playsBggJs.plays == "object"){
            playsBggJs.plays.play = [playsBggJs.plays.play]
        }
        console.log(playsBggJs)
        return playsBggJs.plays.play.map(BGG.parseBggPlay)
    },
    parseBggPlay: play => ({
        id: play["_attributes"].id,
        date: play["_attributes"].date,
        quantity: play["_attributes"].quantity,
        length: play["_attributes"].length,
        incomplete: play["_attributes"].incomplete,
        nowinstats: play["_attributes"].nowinstats,
        location: play["_attributes"].location,
        item: BGG.parseBggItem(play.item),
        // play.players puede ser undefined o un array o un objeto
        players: Array.isArray(play.players?.player) ? play.players.player.map(BGG.parseBggPlayer) : play.players?.player ? [BGG.parseBggPlayer(play.players.player)] : []
    }),
    parseBggItem: item => ({
        id: item["_attributes"].objectid,
        name: item["_attributes"].name
    }),
    parseBggGame: item => ({
        id: item["_attributes"].id,
        name: item.name.filter( name => name["_attributes"].type=="primary" )[0]["_attributes"].value,
        thumbnail: item.thumbnail["_text"],
        image: item.image["_text"],
        weight: item.statistics.ratings.averageweight["_attributes"].value,
        yearpublished: item.yearpublished["_attributes"].value,
        playingtime: item.playingtime?._attributes?.value,
        minplaytime: item.minplaytime?._attributes?.value,
        maxplaytime: item.maxplaytime?._attributes?.value,
        minage: item.minage?._attributes?.value,
    }),
    parseBggUser: item => ({
        id: item["_attributes"].id,
        nick: item["_attributes"].name,
        name: item.firstname["_attributes"].value + " " + item.lastname["_attributes"].value,
        image: item.avatarlink["_attributes"].value,
        yearregistered: item.yearregistered["_attributes"].value,
        lastlogin: item.lastlogin["_attributes"].value,
    }),
    parseBggPlayer: player => ({
        username: player["_attributes"].username,
        userid: player["_attributes"].userid,
        name: player["_attributes"].name,
        startposition: player["_attributes"].startposition,
        color: player["_attributes"].color,
        score: player["_attributes"].score,
        new: player["_attributes"].new,
        rating: player["_attributes"].rating,
        win: player["_attributes"].win,
    })

}