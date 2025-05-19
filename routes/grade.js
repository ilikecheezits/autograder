require('dotenv').config();
const express = require('express');
const router = express.Router({
    mergeParams: true
});
const {
    grabProblem,
    grabAllProblems,
    grabSubs,
    grabStatus,
    createSubmission,
    grabProfile,
    grabUsers,
    grabContestProblems,
    validateUser,
    updateUSACO,
    updateCF,
    getContest,
    getAllContests,
    getStats,
    addProblem
} = require("./sql");
const {
    queue
} = require("./runTests");
const {
    processFunction,
    getToken
} = require("../oauth");
const {
    check
} = require("../profile");
const upload = require('express-fileupload');
const lastSubmission = new Map();
const axios = require('axios');
const codeRunner = require('../services/codeRunner');
const fs = require('fs').promises;
const path = require('path');
router.use(upload());

function getLateTakers(cid) {
    if (cid == 3) return [1001731, 1001623, 1001620, 1001475, 1002158, 1001944, 1001092, 1002595, 1001904, 1001642]; // anush devkar, armaan ahmed, anusha agarwal, kanishk sivanadam, max zhao, rishikesh narayana, samarth bhargav, nathan liang, esha m, navya arora
    if (cid == 4) return [1002636, 1001207, 1001608, 1002135]; //svaran, avni, arjun, olivia
}

router.get("/authlogin", async (req, res) => {
    if (req.session.loggedin) {
        res.redirect("/grade/profile");
    } else {
        let theurl = await getToken();
        res.redirect(theurl);
    }
});
router.get("/login", async (req, res) => {
    let CODE = req.query.code;
    let data = await processFunction(CODE, req, res);
    if (data) {
        await check(data.user_data, data.req, data.res);
    } else {
        res.send("Error logging in as ION could not process our request");
    }
});
router.get("/tjioilogin", (req, res) => {
    if (req.session.loggedin) {
        res.redirect('/grade/profile');
    } else {
        res.render('tjioiLogin');
    }
});
router.post("/tjioilogin", async (req, res) => {
    let id = parseInt(req.body.id);
    if (isNaN(id)) res.send("Invalid credentials");
    let password = req.body.password;
    let valid = await validateUser(id, password);
    if (valid) {
        let data = {
            "id": id
        };
        await check(data, req, res);
    } else {
        res.send("Invalid credentials");
    }
});
router.post("/updateStats", async (req, res) => {
    let usaco = req.body.usaco_div;
    let cf = req.body.cf_handle;
    if (usaco != "" && usaco != undefined) {
        await updateUSACO(req.session.userid, usaco);
        req.session.usaco_div = usaco;
    }
    if (cf != "" && cf != undefined) {
        await updateCF(req.session.userid, cf);
        req.session.cf_handle = cf;
    }
    res.redirect('/grade/profile');
});
router.get("/info", checkLoggedIn, async (req, res) => {
    res.render("info", {
        tjioi: req.session.tjioi
    });
});
router.post("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});
router.get("/profile", checkLoggedIn, (req, res) => {
    if (req.session.tjioi) {
        res.render("tjioiProfile", {
            name: req.session.name,
            username: req.session.username
        });
    } else {
        res.render("profile", {
            name: req.session.name,
            username: req.session.username,
            usaco_div: req.session.usaco_div,
            cf_handle: req.session.cf_handle,
            userid: req.session.userid
        });
    }
});
router.get("/profile/:id", checkLoggedIn, async (req, res) => {
    if (req.session.tjioi) {
        res.redirect("/grade/profile");
    } else {
        let vals = await grabProfile(req.params.id);
        if (vals == false) {
            res.send("No such user");
        } else {
            res.render("fprofile", {
                name: vals.name,
                username: vals.username,
                cf: vals.cf,
                usaco: vals.usaco,
                admin: req.session.admin,
                userid: req.params.id
            });
        }
    }
});
router.get("/", async (req, res) => {
    res.redirect("/grade/profile");
});
router.get("/attendance", async (req, res) => {
    if (req.session.loggedin) {
        deviceClass = 'main';
        if (req.session.mobile) deviceClass = 'phone';
        res.render("attendance", {
            name: vals.name,
            username: vals.username,
            device: deviceClass
        });
    } else {
        res.redirect("/");
    }
});
router.post("/attendanceComplete", async (req, res) => {
    if (req.session.loggedin) {
        let pass = req.body.pass;
        let block = req.body.block;
        res.send("Attendance complete, thank you");
    } else {
        res.redirect("/");
    }
});
router.get("/contests", checkLoggedIn, async (req, res) => {
    let contests = await getAllContests();
    if (!contests) {
        contests = [];  // If getAllContests returns false, use empty array
    }
    contests = contests.filter(function(elem) {
        return !(req.session.tjioi ^ elem.tjioi);
    });
    contests.sort(function(a, b) {
        return (a.id < b.id ? -1 : 1);
    });
    res.render('contests', {
        contests: contests
    });
});
router.get("/contests/:id", checkLoggedIn, async (req, res) => {
    let cid = req.params.id;
    let problems = await grabContestProblems(cid);
    if (problems == undefined) {
        problems = []
    }
    let time = (new Date()).getTime();
    let contest = await getContest(cid);
    let contestStart = new Date(contest.start).getTime();
    let contestEnd = new Date(contest.end).getTime();
    let timeMessage = contestEnd;
    let timeType = "end";
    if (time < contestStart) {
        timeType = "start";
        timeMessage = contestStart;
    }
    var ordered = [];
    for (let i = 0; i < problems.length; i++) {
        if (true) {
            ordered.push(problems[i]);
            ordered[ordered.length - 1].solves = 0;
            ordered[ordered.length - 1].available = (!problems[i].secret || req.session.admin);
            ordered[ordered.length - 1].users = [];
        }
    }
    let subs = await grabSubs(undefined, cid);
    let users = await grabUsers();
    for (let i = 0; i < subs.length; i++) {
        if (parseInt(subs[i].timestamp) > contestEnd) continue;
        let ind, pind;
        for (let j = 0; j < users.length; j++) {
            if (users[j].id == subs[i].user) {
                ind = j;
                break;
            }
        }
        for (let j = 0; j < ordered.length; j++) {
            if (ordered[j].pid == subs[i].problemid) {
                pind = j;
                break;
            }
        }
        if (pind == undefined) {
            console.log("error - cannot find matching problem for submission in rendering solve count: "+subs[i].problemid);
            continue;
        }
        if (ind == undefined) {
            console.log("error - cannot find matching user for submission in rendering solve count: "+subs[i].user);
            continue;
        }
        if (subs[i].verdict == "Accepted" || subs[i].verdict == "AC") {
            if (ordered[pind].users.includes(ind)) continue;
            ordered[pind].solves += 1;
            ordered[pind].users.push(ind);
        }
    }
    ordered.sort(function(a, b) {
        if (a.points == b.points)
            return a.pid > b.pid ? 1 : -1;
        return a.points > b.points ? 1 : -1;
    });
    if (ordered.length > 0)
        res.render("contest", {
            title: contest.name,
            problems: ordered,
            user: req.session.userid,
            cid: cid,
            timeStatus: timeMessage,
            timeType: timeType,
            editorial: contest.editorial
        });
    else
        res.redirect('/grade/contests');
});
async function getStandings(cid) {
    let subs = await grabSubs(undefined, cid);
    let users = await grabUsers();
    let problems = await grabContestProblems(cid);
    problems.sort(function(a, b) {
        return a.pid > b.pid ? 1 : -1;
    });
    let contest = await getContest(cid);
    let contestStart = new Date(contest.start).getTime();
    let contestEnd = new Date(contest.end).getTime();
    let load = [];
    for (let i = 0; i < users.length; i++) {
        let tmp = [];
        for (let j = 0; j < problems.length; j++) {
            tmp.push(0);
        }
        row = {
            name: users[i].display_name,
            id: users[i].id,
            solved: 0,
            problems: tmp,
            penalty: 0
        }
        load.push(row);
    }
    subs.sort(function(a, b) {
        return parseInt(a.timestamp) > parseInt(b.timestamp) ? 1 : -1;
    });
    for (let i = 0; i < subs.length; i++) {
        let contestEnd2 = contestEnd;
        let contestStart2 = contestStart;
        if (cid == 3) {
            if ([1002379].includes(subs[i].user)) contestEnd2 += 50 * 60000; // shaurya bisht
            if ([1001533].includes(subs[i].user)) contestEnd2 += ((4 * 24) * 60 + 30) * 60000; // yicong wang
            if (getLateTakers(3).includes(subs[i].user)) {
                contestEnd2 += (2 * 24 + 20) * 60 * 60000;
            }
        } else if (cid == 4) {
            if (getLateTakers(4).includes(subs[i].user)) {
                contestEnd2 += (3 * 24 + 4) * 60 * 60000;
                contestStart2 += ((3 * 24 + 4) * 60 - 5) * 60000;
            }
        }
        if (parseInt(subs[i].timestamp) > contestEnd2 || parseInt(subs[i].timestamp) < contestStart2) continue;
        let ind, pind;
        for (let j = 0; j < load.length; j++) {
            if (load[j].id == subs[i].user) {
                ind = j;
                break;
            }
        }
        for (let j = 0; j < problems.length; j++) {
            if (problems[j].pid == subs[i].problemid) {
                pind = j;
                break;
            }
        }
        if (subs[i].verdict == "Accepted" || subs[i].verdict == "AC") {
            if (load[ind].problems[pind] >= 1) {
                continue;
            }
            load[ind].solved += problems[pind].points;
            if (Number.isInteger(parseInt(subs[i].timestamp))) {
                let time = parseInt(subs[i].timestamp);
                load[ind].penalty += parseInt((time - contestStart2) / 60000);
            } else {
                console.log("Error, invalid timestamp");
            }
            if (load[ind].problems[pind] < 0) {
                load[ind].penalty -= 10 * load[ind].problems[pind];
            }
            load[ind].problems[pind] = 1 - load[ind].problems[pind];
        } else {
            if (load[ind].problems[pind] < 1) {
                load[ind].problems[pind] -= 1;
            }
        }
    }
    let load2 = [];
    for (let i = 0; i < load.length; i++) {
        let val = load[i];
        if (val.solved > 0 && !(cid==6 && [1002404,1002587,1001623,1001694,1001672,1001944,1001560,1001608,1001865,1001217,1001317,1003218,69].includes(val.id)) && !(cid==7 && [1001849,1001623].includes(val.id))) {
            if (val.penalty >= 0) load2.push(val);
        }
    }
    load2.sort(function(a, b) {
        if (a.solved == b.solved) return a.penalty > b.penalty ? 1 : -1;
        return a.solved < b.solved ? 1 : -1;
    });
    for (let i = 0; i < load2.length; i++) {
        if (i > 0 && load2[i].solved == load2[i - 1].solved && load2[i].penalty == load2[i - 1].penalty) load2[i].rank = load2[i - 1].rank;
        else load2[i].rank = i + 1;
    }
    return {title: contest.name, pnum: problems.length, load: load2};
}
router.get("/contests/:id/standings", checkLoggedIn, async (req, res) => {
    let cid = req.params.id;
    let standings = await getStandings(cid);
    res.render("standings", {
        title: standings.title,
        user: req.session.userid,
        cid: cid,
        pnum: standings.pnum,
        load: standings.load
    });
});
router.get("/contests/:id/status", checkLoggedIn, async (req, res) => {
    let user = req.query.user;
    let cid = req.params.id;
    if (user != undefined) user = Number(user);
    let contest = await getContest(cid);
    let submissions = await grabSubs(user, cid);
    submissions = submissions.filter(function(elem) {
        return req.session.admin || elem.timestamp > new Date(contest.start).getTime();
    });
    res.render("contestStatus", {
        title: contest.name,
        user: req.session.userid,
        cid: cid,
        submissions: submissions
    });
});
router.get("/problemset", checkLoggedIn, async (req, res) => {
    try {
        const problems = await loadProblems();
        const problemList = problems.map(p => ({
            pid: p.id,
            name: p.name,
            points: p.difficulty,
            secret: false
        }));
        problemList.sort((a, b) => a.points - b.points); // Sort by difficulty
        res.render("gradeProblemset", {
            problems: problemList
        });
    } catch (error) {
        console.error('Error loading problems:', error);
        res.send("Error loading problems");
    }
});
router.get("/problemset/:id", checkLoggedIn, async (req, res) => {
    try {
        const problems = await loadProblems();
        const problem = problems.find(p => p.id === req.params.id);
        
        if (!problem) {
            res.send("Problem not found");
            return;
        }

        const problemData = {
            name: problem.name,
            title: problem.name,
            pid: problem.id,
            tl: problem.timeLimit,
            ml: problem.memoryLimit,
            statement: problem.statement.replace(/\n/g, '<br>'),
            inputtxt: problem.inputFormat.replace(/\n/g, '<br>'),
            outputtxt: problem.outputFormat.replace(/\n/g, '<br>'),
            samples: JSON.stringify(problem.samples),
            points: problem.difficulty
        };

        res.render("gradeProblem", problemData);
    } catch (error) {
        console.error('Error loading problem:', error);
        res.send("Error loading problem");
    }
});
router.get("/submit", checkLoggedIn, async (req, res) => {
    let user = req.session.userid;
    let last = await grabSubs(user);
    let problems = await grabAllProblems(req.session.admin);
    if (!problems) {
        problems = [];  // If grabAllProblems returns false, use empty array
    }
    let problemname;
    for (let i = 0; i < problems.length; i++) {
        if (problems[i].pid == req.query.problem) problemname = problems[i].name;
    }
    problems = problems.filter(function(elem) {
        return req.session.tjioi ^ elem.contestid < 202400;
    });
    problems.sort(function(a, b) {
        if (a.pid < b.pid) return -1;
        return 1;
    });
    lastSub='python';
    if (last.length>0) lastSub = last[last.length - 1].language;
    res.render("gradeSubmit", {
        problemid: req.query.problem,
        problemname: problemname,
        lastlang: lastSub,
        problem: problems
    });
});
router.post("/submit", checkLoggedIn, async (req, res) => {
    console.log("Submit route called with body:", {
        language: req.body.lang,
        problemId: req.body.problemid,
        codeLength: req.body.code ? req.body.code.length : 0
    });

    const language = req.body.lang;
    if (language != 'python' && language != 'cpp' && language != 'java') {
        console.log("Invalid language:", language);
        res.send("Unacceptable code language");
        return;
    }

    const pid = req.body.problemid;
    if (!pid) {
        console.log("No problem ID provided");
        res.send("You did not input any problem id");
        return;
    }

    const code = req.body.code;
    if (code.length > 60000) {
        console.log("Code too long:", code.length);
        return res.status(413).send("Submission too long – please keep it under 60,000 characters.");
    }

    try {
        // Get problem details
        console.log("Fetching problem details for ID:", pid);
        const problem = await grabProblem(pid);
        console.log("Problem lookup result:", problem ? "Found" : "Not found");
        
        if (!problem) {
            console.log("Problem not found in database for ID:", pid);
            res.send("Problem not found");
            return;
        }

        // Run the code
        console.log("Running code with codeRunner");
        const result = await codeRunner.runCode({
            code,
            language,
            problemId: pid,
            timeLimit: problem.tl,
            memoryLimit: problem.ml
        });

        console.log("Code execution result:", result);

        if (!result.success) {
            res.send(result.verdict + "\n" + result.output);
            return;
        }

        // Create submission record
        const timestamp = new Date().getTime();
        console.log("Creating submission record");
        const sid = await createSubmission(
            req.session.userid,
            code,
            pid,
            language,
            problem.name,
            problem.cid || -1,
            timestamp
        );

        // Update submission with results
        console.log("Updating submission with results");
        await insertSubmission(
            sid,
            result.verdict,
            result.time || -1,
            result.memory || -1,
            result.output
        );

        res.redirect("/grade/status");
    } catch (error) {
        console.error('Error processing submission:', error);
        res.status(500).send("Internal server error processing your submission");
    }
});
router.get("/status", checkLoggedIn, async (req, res) => {
    let user = req.query.user;
    let contest = req.query.contest;
    let admin = req.session.admin;
    if (user == undefined && contest == undefined && !admin) {
        user = req.session.userid;
    }
    let submissions = await grabSubs(user, contest);
    submissions = submissions.filter(function(elem) {
        return req.session.tjioi ^ elem.contest < 202400;
    });
    let page = req.query.page;
    if (page == undefined) page = 1;
    res.render("gradeStatus", {
        submissions: submissions,
        viewAsAdmin: admin,
        page: page
    });
});
router.get("/status/:id", checkLoggedIn, async (req, res) => {
    let vals = await grabStatus(req.params.id);
    if (vals.user == req.session.userid || req.session.admin) {
        if (!req.session.admin && vals.insight != undefined && vals.insight.startsWith("Viewing as admin")) {
            vals.insight = "You cannot view feedback (not a sample test)";
        }
        vals.admin = req.session.admin;
        res.render("status", {
            submission: vals
        });
    } else {
        res.send("You do not have permission to view this submission");
    }
});
router.get("/rankings", checkLoggedIn, async (req, res) => {
    if (req.session.tjioi) res.redirect('/grade/contests');
    else res.redirect('/grade/rankings/2025');
});
router.get("/rankings/:year", checkLoggedIn, async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        if (isNaN(year)) {
            res.render("rankings", { 
                rankings: [],
                error: "Invalid year parameter"
            });
            return;
        }

        const stats = await getStats(year);
        if (!stats || !Array.isArray(stats)) {
            res.render("rankings", { 
                rankings: [],
                error: "Error fetching rankings data"
            });
            return;
        }

        // Sort by index score in descending order (if we have data)
        if (stats.length > 0) {
            stats.sort((a, b) => b.index - a.index);

            // Add rank numbers
            for (let i = 0; i < stats.length; i++) {
                if (i > 0 && stats[i].index === stats[i - 1].index) {
                    stats[i].rank = stats[i - 1].rank;
                } else {
                    stats[i].rank = i + 1;
                }
            }
        }

        res.render("rankings", { 
            rankings: stats,
            error: stats.length === 0 ? "No rankings data found for this year" : null
        });
    } catch (error) {
        console.error("Error in rankings route:", error);
        res.render("rankings", { 
            rankings: [],
            error: "Internal server error"
        });
    }
});

// Fetch problems from Codeforces API
async function fetchCFProblems() {
    try {
        const response = await axios.get('https://codeforces.com/api/problemset.problems');
        if (response.data.status === 'OK') {
            const problems = response.data.result.problems;
            const problemStatistics = response.data.result.problemStatistics;
            
            // Combine problems with their statistics
            const enrichedProblems = problems.map((problem, index) => ({
                ...problem,
                solvedCount: problemStatistics[index].solvedCount
            }));

            // Sort by rating (difficulty) and solved count
            enrichedProblems.sort((a, b) => {
                if (a.rating === b.rating) {
                    return b.solvedCount - a.solvedCount;
                }
                return (a.rating || 1500) - (b.rating || 1500);
            });

            return enrichedProblems;
        }
        return [];
    } catch (error) {
        console.error('Error fetching CF problems:', error);
        return [];
    }
}

// Add Codeforces problems to database
router.get("/loadCFProblems", async (req, res) => {
    try {
        const problems = await fetchCFProblems();
        let addedCount = 0;
        
        for (const problem of problems.slice(0, 100)) { // Only add first 100 problems
            const problemId = `CF${problem.contestId}${problem.index}`;
            const name = `${problem.name}`;
            
            try {
                await addProblem(
                    problemId,
                    name,
                    -1, // contestId (-1 for CF problems)
                    -1, // checkerId (-1 for CF problems)
                    '', // solution
                    `This is problem ${problem.index} from Codeforces Round #${problem.contestId}.\n\n` +
                    `Please solve this problem on [Codeforces](https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}).\n\n` +
                    `**${problem.name}**`, // statement
                    2000, // time limit
                    256, // memory limit
                    false, // interactive
                    false, // secret
                    'See on Codeforces', // input format
                    'See on Codeforces', // output format
                    '[]', // samples
                    problem.rating || 1500 // points (use CF rating or default to 1500)
                );
                addedCount++;
            } catch (err) {
                console.error(`Error adding problem ${problemId}:`, err);
            }
        }
        
        res.json({ 
            success: true, 
            message: `Added ${addedCount} Codeforces problems to the database`
        });
    } catch (error) {
        console.error('Error in loadCFProblems:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to load Codeforces problems' 
        });
    }
});

function checkLoggedIn(req, res, next) {
    if (req.session.loggedin) {
        if (req.session.mobile) {
            res.redirect("/grade/attendance");
        } else {
            next();
        }
    } else {
        res.redirect("/");
    }
}

router.get("/testProblem/:id", async (req, res) => {
    const problem = await grabProblem(req.params.id);
    res.json({
        problemFound: !!problem,
        problemDetails: problem
    });
});

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

module.exports = router;
