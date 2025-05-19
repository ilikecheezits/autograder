require('dotenv').config();
const express = require('express');
const router = express.Router({
    mergeParams: true
});
const {
    grab,
    grabProblem,
    grabAllProblems,
    addProblem
} = require("./sql");
const {
    getQueue,
    toggleQueue,
    run,
    skip
} = require("./runTests");
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { checkAdmin } = require('../middleware/auth');

function findMex(problems) {
  const pids = problems.map(problem => problem.pid);
  const set = new Set(pids);
  let i = 1;
  while (set.has(i)) {
    i++;
  }
  return i;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/testcases/');
    },
    filename: function (req, file, cb) {
        // Use problem ID and test case number for filename
        const filename = `${req.body.problemId}_${req.body.testNumber}${path.extname(file.originalname)}`;
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only accept text files
        if (file.mimetype === 'text/plain') {
            cb(null, true);
        } else {
            cb(new Error('Only .txt files are allowed'));
        }
    }
});

// Middleware to check if user is admin
router.use(checkAdmin);

router.get("/", async (req, res) => {
    let admin = req.session.admin;
    if (admin) {
        let vals = await grabAllProblems(admin);
        vals.sort(function(a, b) {
            return a.pid > b.pid ? 1 : -1;
        });
        res.render("admin", {
            problems: vals,
            newpid: findMex(vals)
        });
    } else {
        res.redirect("/");
    }
});
router.get("/skip", async (req, res) => {
    let admin = req.session.admin;
    if (admin) {
        let sid = req.query.sid;
        await skip(sid);
        res.redirect("/admin/queue");
    } else {
        res.redirect("/");
    }
});
router.get("/togglepause", async (req, res) => {
    let admin = req.session.admin;
    if (admin) {
        let current = req.query.paused;
        if (current == 'false') {
            //pause the thing
            toggleQueue(true);
        } else {
            //unpause
            toggleQueue(false);
            run();
        }
        res.redirect("/admin/queue");
    } else {
        res.redirect("/");
    }
});
router.get("/queue", async (req, res) => {
    let admin = req.session.admin;
    if (admin) {
        let payload = getQueue();
        let tasks = payload.tasks;
        let paused = payload.paused;
        res.render("adminQueue", {
            submissions: tasks,
            paused: paused
        });
    } else {
        res.redirect("/");
    }
});
router.get("/createProblem", async (req, res) => {
    let pid = req.query.pid;
    if (!pid) {
        pid = -1;
    }
    let admin = req.session.admin;
    if (admin) {
        payload = await grabProblem(pid);
        if (!payload) {
            payload = {
                pid: pid,
                pname: undefined,
                cid: -1,
                state: undefined,
                checkid: -1,
                pts: 1,
                tl: 1000,
                ml: 256,
                secret: true,
                inputtxt: undefined,
                outputtxt: undefined,
                samples: undefined
            }
        } else {
            payload.pid = pid;
            payload.pname = payload.name;
            payload.state = payload.statement;
        }
        res.render("portal", payload);
    } else {
        res.send("You are not an admin");
    }
});
router.get("/getProblem", async (req, res) => {
    let admin = req.session.admin;
    if (admin) {
        let vals = await grab(req.query.id);
        res.json(vals);
    } else {
        res.send("You are not an admin");
    }
});
/*
router.get("/addChecker", async(req, res)=>{ // not in use
        let cid = req.query.cid;
        if (cid == undefined) {
                cid = -1;
        }
        let admin = req.session.admin;
        if (admin) {
                res.render("addChecker", {pid:0, code:""});
        }
});
router.post("/addCheck", async(req, res)=>{ // not in use
        let admin = req.session.admin;
        if (admin) {
                console.log("attempteing to create");
                let pid = req.body.pid;
                let code = req.body.code;
                let lang = req.body.lang;
                let ret = {
                        "pid": pid,
                        "code": code
                };
                console.log(ret);
                await axios.post('http://10.150.0.3:8080/addChecker', querystring.stringify(ret))
                .then(res => {
                        console.log(res);
                }).catch((error) => {
                        console.log("ERROR OOPS");
                        console.log(error);
                });
                res.render("addChecker", ret);
        }
});
router.get("/addTest", async(req, res)=>{ // not in use
        let admin = req.session.admin;
        if (admin) {
                res.render("addTests", {tid:0, pts:100, pid:0, test:"", out:""});
        }
});
router.post("/addTest", async(req, res)=>{ // not in use
        let admin = req.session.admin;
        if (admin) {
                let pid= req.body.pid;
                let tid= req.body.tid;
                let test= req.body.in;
                let out = req.body.out;
                let ret = {
                        "pid": pid,
                        "test":test,
                        "tid": parseInt(tid),
			"out": out
                };
                await axios.post('http://10.150.0.3:8080/addTest', querystring.stringify(ret))
                .then(res => {
                        console.log(res);
                }).catch((error) => {
                        console.log("ERROR OOPS");
                        console.log(error);
                });
                console.log(ret);
		ret.tid = parseInt(tid) + 1;
                res.render("addTests", ret);
        }
});
router.get("/finProblem", async(req, res)=>{ // not in use
        let admin = req.session.admin;
        if (admin) {
                res.render("finProblem", {"pid":0});
        }
});
router.post("/finProblem", async(req, res)=>{ // not in use
        let admin = req.session.admin;
        if (admin) {
                let pid = req.body.pid;
                let ret = {
                        "pid": pid
                }
                makePublic(pid);
                res.render("finProblem", ret);
        }
});
router.get("/compileTests", async(req, res)=>{ // not in use
        console.log("HI");
        let admin = req.session.admin;
        if (admin) {
                res.render("finProblem", {"pid":0});
        }
});
router.post("/compileTests",  async(req, res)=>{ // not in use
        let admin = req.session.admin;
        if (admin) {
                let pid = req.body.pid;
                let ret = {
                        "pid": pid
                }
                compileTests(pid);
                res.render("finProblem", ret);
        }
});
router.get("/addSol",  async(req, res)=>{ // not in use
        let admin = req.session.admin;
        if (admin) {
                res.render("addSol", {pid:0, code:""});
        }
});
router.post("/addSol", async(req, res)=>{ // not in use
        let admin = req.session.admin;
        if (admin) {
                console.log("attempting to create a solution");
                let pid= req.body.pid;
                let code= req.body.code;
                let lang = req.body.lang;
                let ret = {
                        "pid": pid,
                        "code":code,
                        "lang":lang
                };
                console.log(lang);
                addSol(pid, code, lang);
                res.render("addSol", ret);
        }
});
*/
router.post("/create", async (req, res) => {
    let admin = req.session.admin;
    if (admin) {
        console.log("Attempting to create a problem");
        let pts = req.body.pts;
        let pid = req.body.pid;
        let pname = req.body.pname;
        let cid = req.body.cid;
        let state = req.body.state;
        let tl = req.body.tl;
        let ml = req.body.ml;
        let secret = req.body.secret;
        let checkid = req.body.checkid;
        let inputtxt = req.body.inputtxt;
        let outputtxt = req.body.outputtxt;
        let samples = req.body.samples;
        console.log(req.body);
        /*let ret = {
            "pts": pts,
            "pid": pid,
            "pname": pname,
            "cid": cid,
            "state": state,
            "tl": tl,
            "ml": ml,
            "secret": secret,
            "checkid": checkid,
            "inputtxt": inputtxt,
            "outputtxt": outputtxt,
            "samples": samples
        };*/
        await addProblem(pid, pname, cid, checkid, '', state, tl, ml, false, secret, inputtxt, outputtxt, samples, pts);
        res.redirect("/admin");
    } else {
        res.send("You are not an admin");
    }
});
router.get("/disableAdmin", async (req, res) => {
    req.session.admin = false;
    res.redirect("/");
});

/**
 * Upload test cases for a problem
 * POST /admin/testcases/upload
 * Body: 
 * - problemId: Problem ID
 * - testNumber: Test case number
 * - input: Input file
 * - output: Output file
 */
router.post('/testcases/upload', upload.fields([
    { name: 'input', maxCount: 1 },
    { name: 'output', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files.input || !req.files.output) {
            return res.status(400).json({ error: 'Both input and output files are required' });
        }

        const { problemId, testNumber } = req.body;
        if (!problemId || !testNumber) {
            return res.status(400).json({ error: 'Problem ID and test number are required' });
        }

        // Validate test case format
        const input = await fs.readFile(req.files.input[0].path, 'utf8');
        const output = await fs.readFile(req.files.output[0].path, 'utf8');

        // TODO: Add validation for input/output format based on problem requirements

        res.json({ 
            message: 'Test cases uploaded successfully',
            files: {
                input: req.files.input[0].filename,
                output: req.files.output[0].filename
            }
        });
    } catch (error) {
        console.error('Error uploading test cases:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get test cases for a problem
 * GET /admin/testcases/:problemId
 */
router.get('/testcases/:problemId', async (req, res) => {
    try {
        const { problemId } = req.params;
        const testcasesDir = 'uploads/testcases/';
        const files = await fs.readdir(testcasesDir);
        
        const testcases = files
            .filter(file => file.startsWith(problemId))
            .map(file => ({
                name: file,
                type: file.includes('input') ? 'input' : 'output',
                number: parseInt(file.match(/\d+/)[0])
            }));

        res.json({ testcases });
    } catch (error) {
        console.error('Error getting test cases:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
