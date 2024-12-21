SELECT 
    p.id, 
    p.date, 
    p.game, 
    p.reporter, 
    p.json
FROM 
    plays p
JOIN (
    SELECT 
        date, 
        game
    FROM 
        plays
    GROUP BY 
        date, 
        game,
		duplicate
    HAVING 
        COUNT(*) > 1
) duplicates
ON 
    p.date = duplicates.date AND 
    p.game = duplicates.game 
	
ORDER BY 
    p.date DESC, 
    p.game;