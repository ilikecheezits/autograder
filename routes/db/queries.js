/**
 * Database queries for user statistics and rankings
 */

const { pl } = require('../sql');

/**
 * Updates a user's USACO division in the database
 * @param {number} id - User ID
 * @param {string} usaco - USACO division ('none', 'bronze', 'silver', 'gold', 'plat')
 * @returns {Promise<boolean>} Success status
 */
async function updateUSACO(id, usaco) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.error("Error connecting to database:", err);
                resolve(false);
                return;
            }

            const qry = `UPDATE users SET usaco_division = $1 WHERE id = $2;`;
            client.query(qry, [usaco, id], (err, results) => {
                release();
                if (err) {
                    console.error("Error updating USACO division:", err);
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    });
}

/**
 * Updates a user's Codeforces handle in the database
 * @param {number} id - User ID
 * @param {string} handle - Codeforces handle
 * @returns {Promise<boolean>} Success status
 */
async function updateCF(id, handle) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.error("Error connecting to database:", err);
                resolve(false);
                return;
            }

            // Validate CF handle format
            if (handle && !/^[a-zA-Z0-9_.-]{3,24}$/.test(handle)) {
                console.error("Invalid Codeforces handle format");
                resolve(false);
                return;
            }

            const qry = `UPDATE users SET cf_handle = $1 WHERE id = $2;`;
            client.query(qry, [handle, id], (err, results) => {
                release();
                if (err) {
                    console.error("Error updating CF handle:", err);
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    });
}

/**
 * Updates Codeforces ratings for all users with CF handles
 * @returns {Promise<boolean>} Success status
 */
async function updateCFRating() {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.error("Error connecting to database:", err);
                resolve(false);
                return;
            }

            const qry = `SELECT * FROM users WHERE cf_handle IS NOT NULL`;
            client.query(qry, [], async (err, results) => {
                if (err) {
                    console.error("Error querying users:", err);
                    resolve(false);
                    return;
                }

                if (results.rows.length === 0) {
                    release();
                    resolve(true);
                    return;
                }

                // Build CF API URL
                const handles = results.rows.map(row => row.cf_handle).join(';');
                const url = `https://codeforces.com/api/user.info?handles=${handles}`;

                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error('CF API response was not ok');
                    }

                    const data = await response.json();
                    if (data.status !== "OK") {
                        throw new Error('CF API returned error status');
                    }

                    // Update ratings in database
                    const updates = data.result.map((user, i) => {
                        const rating = isNaN(user.maxRating) ? 0 : user.maxRating;
                        const qry = `UPDATE users SET cf_rating = $1 WHERE id = $2;`;
                        return client.query(qry, [rating, results.rows[i].id]);
                    });

                    await Promise.all(updates);
                    resolve(true);
                } catch (error) {
                    console.error("Error updating CF ratings:", error);
                    resolve(false);
                } finally {
                    release();
                }
            });
        });
    });
}

/**
 * Gets user statistics and rankings for a given academic year
 * @param {number} season - Academic year (e.g., 2025)
 * @returns {Promise<Array>} Array of user statistics
 */
async function getStats(season) {
    // Update CF ratings before getting stats
    await updateCFRating();

    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.error("Error connecting to database:", err);
                resolve([]);
                return;
            }

            const qry = `
                WITH user_scores AS (
                    SELECT 
                        u.id,
                        u.display_name,
                        CAST(COALESCE(u.usaco_division, '0') AS INTEGER) as usaco_division,
                        CAST(COALESCE(u.cf_rating, '0') AS INTEGER) as cf_rating,
                        u.username,
                        COUNT(DISTINCT CASE WHEN s.verdict = 'Accepted' THEN s.problemid END) as problems_solved
                    FROM users u
                    LEFT JOIN submissions s ON u.id = s.usr
                    WHERE LEFT(u.username, 4) ~ '^[0-9]+$'
                    AND CAST(LEFT(u.username, 4) AS INTEGER) >= $1
                    GROUP BY u.id, u.display_name, u.usaco_division, u.cf_rating, u.username
                )
                SELECT 
                    id,
                    display_name,
                    usaco_division,
                    cf_rating,
                    problems_solved,
                    CASE 
                        WHEN usaco_division = 4 THEN 1000  -- Platinum
                        WHEN usaco_division = 3 THEN 800   -- Gold
                        WHEN usaco_division = 2 THEN 600   -- Silver
                        WHEN usaco_division = 1 THEN 400   -- Bronze
                        ELSE 200                           -- Not participated
                    END as usaco_score,
                    cf_rating as cf_score,
                    problems_solved * 10 as inhouse_score
                FROM user_scores;
            `;
            
            client.query(qry, [season], (err, results) => {
                release();
                if (err) {
                    console.error("Error querying stats:", err);
                    resolve([]);
                    return;
                }

                const stats = results.rows.map(row => {
                    // Normalize scores to 0-1000 scale
                    const usaco = row.usaco_score;
                    const cf = Math.min(1000, Math.max(0, row.cf_score / 3));  // CF rating / 3 (max 1000)
                    const inhouse = Math.min(1000, row.inhouse_score);  // 10 points per problem (max 1000)
                    
                    // Calculate weighted index (40% USACO, 30% CF, 30% In-house)
                    const index = (usaco * 0.4) + (cf * 0.3) + (inhouse * 0.3);
                    
                    return {
                        id: row.id,
                        name: row.display_name,
                        usaco: usaco,
                        cf: cf,
                        inhouse: inhouse,
                        index: index
                    };
                });

                resolve(stats);
            });
        });
    });
}

module.exports = {
    updateUSACO,
    updateCF,
    updateCFRating,
    getStats
}; 