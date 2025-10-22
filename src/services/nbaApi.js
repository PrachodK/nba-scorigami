/**
 * NBA Stats API Service
 * Uses balldontlie.io API - free, no CORS issues
 */

const BALL_DONT_LIE_BASE = 'https://api.balldontlie.io/v1';
const API_KEY = process.env.REACT_APP_NBA_API_KEY;

// Helper function to create headers with API key
const getHeaders = () => ({
  'Authorization': API_KEY,
  'Content-Type': 'application/json',
});

/**
 * Fetch current season schedule
 * @returns {Promise<Array>} Array of scheduled games
 */
export const fetchSchedule = async () => {
  try {
    // Fetch today's games from balldontlie.io
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch(`${BALL_DONT_LIE_BASE}/games?dates[]=${today}`, {
      headers: getHeaders()
    });
    const data = await response.json();

    if (!data.data) {
      return [];
    }

    return data.data.map(game => ({
      id: game.id,
      date: new Date(game.date),
      gameStatus: game.status,
      gameStatusText: game.status,
      team1: game.visitor_team.full_name,
      team1City: game.visitor_team.city,
      team1TriCode: game.visitor_team.abbreviation,
      team2: game.home_team.full_name,
      team2City: game.home_team.city,
      team2TriCode: game.home_team.abbreviation,
      arena: '',
      awayScore: game.visitor_team_score,
      homeScore: game.home_team_score,
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
    // balldon lie.io uses seasons as integers (2024 for 2024-25 season)
    const seasonYear = parseInt(season.split('-')[0]);

    const allGames = [];
    let page = 0;
    let hasMore = true;

    // Fetch all pages
    while (hasMore && page < 10) { // Limit to 10 pages for safety
      const response = await fetch(
        `${BALL_DONT_LIE_BASE}/games?seasons[]=${seasonYear}&per_page=100&page=${page}`,
        { headers: getHeaders() }
      );
      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        hasMore = false;
        break;
      }

      allGames.push(...data.data);

      // Check if there are more pages
      hasMore = data.meta && data.meta.next_page !== null;
      page++;

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return allGames.map(game => ({
      gameId: game.id,
      gameDate: new Date(game.date),
      teamName: game.home_team.full_name,
      teamAbbreviation: game.home_team.abbreviation,
      matchup: `${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation}`,
      wl: game.home_team_score > game.visitor_team_score ? 'W' : 'L',
      points: game.home_team_score,
    }));
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
    // Format date as YYYY-MM-DD
    const dateStr = date.toISOString().split('T')[0];

    const response = await fetch(`${BALL_DONT_LIE_BASE}/games?dates[]=${dateStr}&per_page=100`, {
      headers: getHeaders()
    });
    const data = await response.json();

    if (!data.data) {
      return [];
    }

    return data.data.map(game => {
      // Map status text to numeric codes for compatibility
      // "" = scheduled (1), "In Progress" = live (2), "Final" = final (3)
      let gameStatus = 1;
      if (game.status === 'Final') gameStatus = 3;
      else if (game.status.includes('Progress') || game.status.includes('Quarter') || game.status.includes('Half')) gameStatus = 2;

      return {
        gameId: game.id,
        gameDate: new Date(game.date),
        gameStatus: gameStatus,
        gameStatusText: game.status,
        period: game.period || 0,
        gameClock: game.time || '',

        // Away team
        awayTeam: game.visitor_team.name,
        awayTeamCity: game.visitor_team.city,
        awayTeamTricode: game.visitor_team.abbreviation,
        awayScore: game.visitor_team_score || 0,

        // Home team
        homeTeam: game.home_team.name,
        homeTeamCity: game.home_team.city,
        homeTeamTricode: game.home_team.abbreviation,
        homeScore: game.home_team_score || 0,

        arena: '',
      };
    });
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
    // For now, just fetch the last 2 seasons to avoid too many API calls
    const currentYear = new Date().getFullYear();
    const seasons = [currentYear - 1, currentYear];

    const allGames = [];

    for (const season of seasons) {
      try {
        const games = await fetchSeasonGames(`${season}-${String(season + 1).slice(-2)}`);
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
