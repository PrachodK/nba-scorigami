/**
 * NBA Stats API Service
 * Uses official NBA.com stats endpoints for live data
 * No authentication required, but includes proper headers to avoid blocking
 */

const NBA_STATS_BASE = 'https://stats.nba.com/stats';
const NBA_CDN_BASE = 'https://cdn.nba.com/static/json/liveData';

// Required headers to avoid being blocked
const NBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

/**
 * Fetch current season schedule
 * @returns {Promise<Array>} Array of scheduled games
 */
export const fetchSchedule = async () => {
  try {
    // Using NBA's scoreboard endpoint which includes upcoming games
    // Note: We could expand this to fetch multiple days if needed

    // For now, let's use a simpler approach - fetch today's scoreboard
    const response = await fetch(`${NBA_CDN_BASE}/scoreboard/todaysScoreboard_00.json`);
    const data = await response.json();

    if (!data.scoreboard?.games) {
      return [];
    }

    return data.scoreboard.games.map(game => ({
      id: game.gameId,
      date: new Date(game.gameTimeUTC),
      gameStatus: game.gameStatus,
      gameStatusText: game.gameStatusText,
      team1: game.awayTeam.teamName,
      team1City: game.awayTeam.teamCity,
      team1TriCode: game.awayTeam.teamTricode,
      team2: game.homeTeam.teamName,
      team2City: game.homeTeam.teamCity,
      team2TriCode: game.homeTeam.teamTricode,
      arena: game.arenaName,
      awayScore: game.awayTeam.score,
      homeScore: game.homeTeam.score,
    }));
  } catch (error) {
    console.error('Error fetching NBA schedule:', error);
    return [];
  }
};

/**
 * Fetch all games for a specific season
 * @param {string} season - Season in format "2024-25"
 * @returns {Promise<Array>} Array of all games with scores
 */
export const fetchSeasonGames = async (season = '2024-25') => {
  try {

    // NBA's leaguegamelog endpoint gets all games for a season
    const url = `${NBA_STATS_BASE}/leaguegamelog`;
    const params = new URLSearchParams({
      Season: season,
      SeasonType: 'Regular Season',
      LeagueID: '00',
      Direction: 'DESC',
      Sorter: 'DATE'
    });

    const response = await fetch(`${url}?${params}`, {
      headers: NBA_HEADERS
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.resultSets || !data.resultSets[0]) {
      return [];
    }

    const headers = data.resultSets[0].headers;
    const rows = data.resultSets[0].rowSet;

    // Map the data to our format
    return rows.map(row => {
      const game = {};
      headers.forEach((header, index) => {
        game[header] = row[index];
      });

      return {
        gameId: game.GAME_ID,
        gameDate: new Date(game.GAME_DATE),
        teamName: game.TEAM_NAME,
        teamAbbreviation: game.TEAM_ABBREVIATION,
        matchup: game.MATCHUP,
        wl: game.WL,
        points: game.PTS,
      };
    });
  } catch (error) {
    console.error('Error fetching season games:', error);
    return [];
  }
};

/**
 * Fetch live scoreboard for a specific date
 * @param {Date} date - Date to fetch scores for
 * @returns {Promise<Array>} Array of games with live scores
 */
export const fetchScoreboard = async (date = new Date()) => {
  try {
    // Try CDN endpoint first (faster, cached)
    // Note: Date parameter could be used for historical lookups in the future
    const cdnUrl = `${NBA_CDN_BASE}/scoreboard/todaysScoreboard_00.json`;

    const response = await fetch(cdnUrl);
    const data = await response.json();

    if (!data.scoreboard?.games) {
      return [];
    }

    return data.scoreboard.games.map(game => ({
      gameId: game.gameId,
      gameDate: new Date(game.gameTimeUTC),
      gameStatus: game.gameStatus, // 1 = scheduled, 2 = live, 3 = final
      gameStatusText: game.gameStatusText,
      period: game.period,
      gameClock: game.gameClock,

      // Away team
      awayTeam: game.awayTeam.teamName,
      awayTeamCity: game.awayTeam.teamCity,
      awayTeamTricode: game.awayTeam.teamTricode,
      awayScore: game.awayTeam.score,

      // Home team
      homeTeam: game.homeTeam.teamName,
      homeTeamCity: game.homeTeam.teamCity,
      homeTeamTricode: game.homeTeam.teamTricode,
      homeScore: game.homeTeam.score,

      arena: game.arenaName,
    }));
  } catch (error) {
    console.error('Error fetching scoreboard:', error);
    return [];
  }
};

/**
 * Fetch historical games using the old format (similar to Games.csv)
 * This builds a comprehensive game history from multiple seasons
 */
export const fetchHistoricalGames = async () => {
  try {
    // We'll fetch game data from stats.nba.com for multiple seasons
    const seasons = [];
    const currentYear = 2025;

    // Generate season strings from 1946 to current (NBA history)
    for (let year = 1946; year <= currentYear; year++) {
      const nextYear = String(year + 1).slice(-2);
      seasons.push(`${year}-${nextYear}`);
    }

    console.log(`Fetching historical data for ${seasons.length} seasons...`);

    // For now, let's just fetch recent seasons to avoid too many API calls
    // You can expand this later
    const recentSeasons = seasons.slice(-5); // Last 5 seasons

    const allGames = [];

    for (const season of recentSeasons) {
      try {
        const games = await fetchSeasonGames(season);
        allGames.push(...games);

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.warn(`Failed to fetch season ${season}:`, err);
      }
    }

    return allGames;
  } catch (error) {
    console.error('Error fetching historical games:', error);
    return [];
  }
};

/**
 * Get today's games with live updates
 */
export const getTodaysGames = () => fetchScoreboard(new Date());

/**
 * Get upcoming games (next 7 days)
 */
export const getUpcomingGames = async () => {
  try {
    const games = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const dayGames = await fetchScoreboard(date);
      games.push(...dayGames);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return games.filter(game => game.gameStatus === 1); // Only upcoming
  } catch (error) {
    console.error('Error fetching upcoming games:', error);
    return [];
  }
};

const nbaApi = {
  fetchSchedule,
  fetchSeasonGames,
  fetchScoreboard,
  fetchHistoricalGames,
  getTodaysGames,
  getUpcomingGames,
};

export default nbaApi;
