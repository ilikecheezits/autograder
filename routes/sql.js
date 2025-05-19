const {
    Pool
} = require('pg');
const pl = new Pool({
    user: "Samuel",
    port: 5432,
    database: "autograder",
    max: 100,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true
});

const fs = require('fs').promises;
const path = require('path');

// Load problems from JSON file
async function loadProblems() {
    try {
        const data = await fs.readFile(path.join(__dirname, '..', 'problems', 'problems.json'), 'utf8');
        return JSON.parse(data).problems;
    } catch (error) {
        console.error('Error loading problems:', error);
        return [];
    }
}

async function grab(id) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = "SELECT * FROM problems WHERE pid = $1";
            client.query(qry, [id], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying", err);
                    resolve(false);
                }
                if (results.rows.length == 0) {
                    resolve(false);
                } else {
                    let ret = {
                        id: id,
                        title: results.rows[0].name,
                        statement: results.rows[0].statement,
                        secret: results.rows[0].secret,
                        tl: results.rows[0].tl,
                        ml: results.rows[0].ml,
                        contestid: results.rows[0].contestid,
                        checkerid: results.rows[0].checkerid
                    }
                    resolve(ret);
                }
            });
        });
    });
}
async function grabChecker(id) { // not in use
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = "SELECT * FROM checker WHERE id= $1";
            client.query(qry, [id], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for checker", err);
                    resolve(false);
                }
                if (results.rows.length == 0) {
                    resolve(false);
                } else {
                    let ret = {
                        id: id,
                        code: results.rows[0].code,
                        lang: results.rows[0].lang
                    }
                    resolve(ret);
                }
            });
        });
    });
}
async function grabAllProblems(isAdmin) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = "SELECT * FROM problems WHERE (problems.secret IS NULL OR problems.secret = false OR problems.secret = $1)";
            let params = [];
            if (isAdmin) {
                params.push(true)
            } else {
                params.push(null)
            }
            client.query(qry, params, (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for problems", err);
                    resolve(false);
                }
                if (results.rows.length == 0) {
                    resolve(false);
                } else {
                    resolve(results.rows);
                }
            });
        });
    });
}
async function grabSubs(user, contest) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            if (isNaN(contest)) {
                contest = undefined;
            }
            if (isNaN(user)) {
                user = undefined;
            }
            let qry = undefined;
            let params = [];
            if (contest == undefined && user == undefined) {
                qry = "SELECT * FROM submissions ORDER BY id ASC;";
            } else if (contest == undefined) {
                qry = "SELECT * FROM submissions WHERE submissions.usr = $1 ORDER BY id ASC;";
                params.push(user);
            } else if (user == undefined) {
                qry = "SELECT * FROM submissions WHERE submissions.contest = $1 ORDER BY id ASC;";
                params.push(contest);
            } else {
                qry = "SELECT * FROM submissions WHERE submissions.usr = $1 AND submissions.contest = $2 ORDER BY id ASC;";
                params.push(user);
                params.push(contest);
            }
            client.query(qry, params, (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for submissions", err);
                    resolve([]);
                } else if (results.rows.length == 0) {
                    resolve([]);
                } else {
                    retarr = [];
                    for (let i = 0; i < results.rows.length; i++) {
                        let ret = {
                            user: results.rows[i].usr,
                            id: results.rows[i].id,
                            verdict: results.rows[i].verdict,
                            runtime: results.rows[i].runtime,
                            problemname: results.rows[i].problemname,
                            problemid: results.rows[i].problemid,
                            timestamp: results.rows[i].timestamp,
                            language: results.rows[i].language,
                            contest: results.rows[i].contest
                        }
                        retarr.push(ret);
                    }
                    resolve(retarr);
                }
            });
        });
    });
}
async function grabStatus(id) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = "SELECT * FROM submissions WHERE id = $1";
            client.query(qry, [id], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for status", err);
                    resolve(false);
                }
                if (results.rows.length == 0) {
                    resolve(false);
                } else {
                    let ret = {
                        user: results.rows[0].usr,
                        verdict: results.rows[0].verdict,
                        runtime: results.rows[0].runtime,
                        problemname: results.rows[0].problemname,
                        problemid: results.rows[0].problemid,
                        code: results.rows[0].code,
                        language: results.rows[0].language,
                        insight: results.rows[0].insight,
                        timestamp: results.rows[0].timestamp
                    }
                    resolve(ret);
                }
            });
        });
    });
}
async function grabProblem(id) {
    console.log('grabProblem called with id:', id);
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(null);
                return;
            }
            let qry = "SELECT * FROM problems WHERE pid = $1";
            console.log('Executing query:', qry, 'with id:', id);
            client.query(qry, [id], (err, results) => {
                release();
                if (err) {
                    console.log("An error occurred while querying", err);
                    resolve(null);
                    return;
                }
                console.log('Query results:', results.rows);
                if (results.rows.length == 0) {
                    console.log('No problem found with id:', id);
                    resolve(null);
                } else {
                    const problem = results.rows[0];
                    console.log('Found problem:', problem);
                    resolve({
                        id: problem.pid,
            name: problem.name,
            title: problem.name,
                        statement: problem.statement,
                        tl: problem.tl,
                        ml: problem.ml,
                        inputtxt: problem.inputtxt,
                        outputtxt: problem.outputtxt,
                        samples: problem.samples,
                        points: problem.points,
                        contestid: problem.contestid,
                        checkerid: problem.checkerid,
                        secret: problem.secret
                    });
                }
            });
        });
    });
}
async function insertSubmission(sid, verdict, runtime, memory, output) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.error("Error getting client for insertSubmission:", err);
                resolve(false);
                return;
            }
            
            const qry = `UPDATE submissions 
                        SET verdict = $1, runtime = $2, memory = $3, output = $4 
                        WHERE id = $5 
                        RETURNING id`;
            const vals = [verdict, runtime, memory, output, sid];
            
            client.query(qry, vals, (err, results) => {
                release();
                if (err) {
                    console.error("Error updating submission:", err);
                    resolve(false);
                    return;
                }
                resolve(results.rows.length > 0);
            });
        });
    });
}
async function createSubmission(user, code, problem, language, problemname, cid, timestamp) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `INSERT INTO submissions (usr, code, problemid, language, runtime, memory, verdict, problemname, contest, timestamp) values ($1, $2, $3, $4, -1, -1, 'Running', $5, $6, $7) RETURNING id`;
            let vals = [user, code, problem, language, problemname, cid, timestamp];
            client.query(qry, vals, (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying to create submission", err);
                    resolve(false);
                } else if (results.rows.length == 0) {
                    resolve(false);
                } else {
                    resolve(results.rows[0].id);
                }
            });
        });
    });
}
async function grabProfile(id) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `SELECT * FROM users WHERE id = $1`;
            client.query(qry, [id], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for profile", err);
                    resolve(false);
                }
                if (results.rows.length == 0) {
                    resolve(false);
                } else {
                    res = {
                        username: results.rows[0].username,
                        name: results.rows[0].display_name,
                        cf: results.rows[0].cf_handle,
                        usaco: results.rows[0].usaco_division
                    }
                    resolve(res);
                }
            });
        });
    });
}
async function addTest(tid, pid, tval) { // not in use
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `INSERT INTO test (points,pid, test) VALUES ($1, $2, $3) RETURNING id;`;
            client.query(qry, [pts, pid, tval], (err, results) => {
                release();
                if (err) {
                    console.log("Error while querying");
                    resolve(false);
                }
                resolve(true);
            });
        });
    });
}
async function updateChecker(checkid, checkercode, lang) { // not in use
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `UPDATE CHECKER SET code=$1, lang=$2 WHERE id = $3;`;
            client.query(qry, [checkercode, lang, checkid], (err, results) => {
                release();
                if (err) {
                    console.log("Error while querying");
                    resolve(false);
                }
                resolve(true);
            });
        });
    });
}
async function addChecker(checkid, checkercode, lang) { // not in use
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `INSERT INTO checker (code, lang) VALUES ($1, $2) RETURNING id;`;
            client.query(qry, [checkercode, lang], (err, results) => {
                release();
                if (err) {
                    console.log("Error while querying");
                    resolve(false);
                }
                resolve(true);
            });
        });
    });
}

async function addSol(pid, code, lang) { // not in use
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `UPDATE problems SET solution=$1, sollang=$3 WHERE pid=$2`;
            client.query(qry, [code, pid, lang], (err, results) => {
                release();
                if (err) {
                    console.log("Error while querying");
                    resolve(false);
                }
                resolve(true);
            });
        });
    });
}
async function addProblem(pid, pname, cid, checkid, sol, state, tl, ml, inter, secret, inputtxt, outputtxt, samples, points) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            console.log(pid, secret, inputtxt, outputtxt, samples);
            // pid | name | contestid | checkerid | solution | statement | tl | ml | interactive | secret | points 
            let qry = `INSERT INTO problems (pid, name, contestid, checkerid,solution, statement, tl, ml, interactive, secret, inputtxt, outputtxt, samples, points)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (pid)
			DO UPDATE SET 
				name = excluded.name,
				contestid= excluded.contestid,
				checkerid= excluded.checkerid,
				statement= excluded.statement,
				tl= excluded.tl,
				ml= excluded.ml,
				interactive= excluded.interactive,
				secret= excluded.secret,
				points = excluded.points,
				inputtxt = excluded.inputtxt,
				outputtxt = excluded.outputtxt,
				samples = excluded.samples
			`;
            client.query(qry, [pid, pname, cid, checkid, sol, state, tl, ml, inter, secret, inputtxt, outputtxt, samples, points], (err, results) => {
                release();
                if (err) {
                    console.log("Error while querying to add problem", err);
                    resolve(false);
                }
                resolve(results);
            });
        });
    });
}
async function grabUsers() {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = "SELECT * FROM users;";
            client.query(qry, (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for users", err);
                    resolve(false)
                }
                if (results.rows.length == 0) {
                    resolve(false);
                } else {
                    resolve(results.rows);
                }
            });
        });
    });
}
async function grabContestProblems(cid) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `SELECT * FROM problems WHERE contestid = $1`;
            client.query(qry, [cid], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for contest problems", err);
                    resolve(false)
                }
                resolve(results.rows);
            });
        });
    });
}
async function validateUser(id, password) {
    return true; // Accept any login attempt
}
async function updateUSACO(id, usaco) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `UPDATE users SET usaco_division = $1 WHERE id = $2;`;
            client.query(qry, [usaco, id], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying to update usaco division", err);
                }
                resolve(true);
            });
        });
    });
}
async function updateCF(id, cf) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `UPDATE users SET cf_handle = $1 WHERE id = $2;`;
            client.query(qry, [cf, id], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying to update cf handle", err);
                    resolve(false);
                }
                resolve(true);
            });
        });
    });
}
async function updateCFRating() {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `SELECT * FROM users WHERE cf_handle IS NOT NULL`;
            client.query(qry, [], (err, results) => {
                if (err) {
                    console.log("An error occured while querying to update cf rating", err);
                    resolve(false);
                }
                if (results.rows.length == 0) {
                    resolve(false);
                }
                let url = "https://codeforces.com/api/user.info?handles="
                for (let i = 0; i < results.rows.length; i++) {
                    url += results.rows[i].cf_handle;
                    if (i + 1 < results.rows.length) url+=";";
                }
                fetch(url).then(response => {
                    if (!response.ok) {
                        throw new Error('CF API response was not ok: '+url);
                    }
                    return response.json();
                }).then(data => {
                    if (data["status"]!="OK") {
                        throw new Error('CF API response was not ok: '+url);
                    }
                    data = data["result"];
                    for (let i = 0; i < results.rows.length; i++) {
                        let qry2 = `UPDATE users SET cf_rating = $1 WHERE id = $2;`;
                        if (isNaN(data[i].maxRating)) {
                            data[i].maxRating = 0;
                        }
                        client.query(qry2, [data[i].maxRating, results.rows[i].id], (err, res) => {
                            if (err) {
                                console.log("An error occured while querying to update cf rating", err);
                                resolve(false);
                            }
                        });
                    }
                    release();
                    resolve(true);
                }).catch(error => {
                    console.log('Error when using CF API', error);
                    resolve(false);
                });
            });
        });
    });
}
async function getStats(season) {
    await updateCFRating();
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `
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
                        WHEN usaco_division = 4 THEN 1000
                        WHEN usaco_division = 3 THEN 800
                        WHEN usaco_division = 2 THEN 600
                        WHEN usaco_division = 1 THEN 400
                        ELSE 200
                    END as usaco_score,
                    cf_rating as cf_score,
                    problems_solved * 10 as inhouse_score
                FROM user_scores;
            `;
            
            client.query(qry, [season], (err, results) => {
                release();
                if (err) {
                    console.error("Error querying for stats:", err);
                    resolve([]);
                    return;
                }

                const retarr = results.rows.map(row => {
                    // Calculate normalized scores (0-1000 scale)
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

                resolve(retarr);
            });
        });
    });
}
async function getAllContests() {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve([]);
            }
            let qry = `SELECT * FROM contests;`;
            client.query(qry, [], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for contests", err);
                    resolve([]);
                }
                if (results.rows.length == 0) {
                    resolve([]);
                } else {
                    resolve(results.rows);
                }
            });
        });
    });
}
async function getContest(cid) {
    return new Promise((resolve, reject) => {
        pl.connect((err, client, release) => {
            if (err) {
                console.log("Error getting client");
                resolve(false);
            }
            let qry = `SELECT * FROM contests WHERE id = $1;`;
            client.query(qry, [cid], (err, results) => {
                release();
                if (err) {
                    console.log("An error occured while querying for contest", err);
                    resolve(false);
                }
                if (results.rows.length == 0) {
                    resolve(false);
                } else {
                    resolve(results.rows[0]);
                }
            });
        });
    });
}

module.exports = {
    grab: (id) => {
        if (Number(id))
            return grab(id);
        return;
    },
    grabChecker: (id) => {
        if (Number(id))
            return grabChecker(id);
    },
    grabAllProblems: (isAdmin) => {
        return grabAllProblems(isAdmin);
    },
    grabSubs: (user, contest) => {
        return grabSubs(user, contest);
    },
    grabStatus: (id) => {
        if (Number(id))
            return grabStatus(id);
        return;
    },
    grabProblem: (id) => {
            return grabProblem(id);
    },
    grabTests: (id) => {
        if (Number(id))
            return grabTests(id);
        return;
    },
    grabProfile: (id) => {
        if (Number(id))
            return grabProfile(id);
        return false;
    },
    insertSubmission: (sid, verdict, runtime, memory, output) => {
        return insertSubmission(sid, verdict, runtime, memory, output);
    },
    createSubmission: (user, code, problem, language, problemname, cid, timestamp) => {
        return createSubmission(user, code, problem, language, problemname, cid, timestamp);
    },
    addProblem: (pid, pname, cid, checkid, sol, state, tl, ml, inter, secret, inputtxt, outputtxt, samples, points) => {
        return addProblem(pid, pname, cid, checkid, sol, state, tl, ml, inter, secret, inputtxt, outputtxt, samples, points);
    },
    addChecker: (checkid, code, lang) => {
        return addChecker(checkid, code, lang);
    },
    updateChecker: (checkid, code, lang) => {
        return updateChecker(checkid, code, lang);
    },
    addSol: (pid, code, lang) => {
        return addSol(pid, code, lang);
    },
    grabUsers: () => {
        return grabUsers();
    },
    grabContestProblems: (cid) => {
        if (Number(cid))
            return grabContestProblems(cid);
        return;
    },
    validateUser: (id, password) => {
        return validateUser(id, password);
    },
    updateUSACO: (id, usaco) => {
        return updateUSACO(id, usaco);
    },
    updateCF: (id, cf) => {
        return updateCF(id, cf);
    },
    getAllContests: () => {
        return getAllContests();
    },
    getContest: (cid) => {
        return getContest(cid);
    },
    getStats: (season) => {
        return getStats(season);
    },
    pl
}
