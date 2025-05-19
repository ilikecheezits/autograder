require('dotenv').config();
const session = require('express-session');
const express = require("express");
const app = express();
const port = 3000;
const gradeRouter = require("./routes/grade");
const adminRouter = require("./routes/admin");
// Temporarily disabled CSRF protection
// const { generateCSRFToken, validateCSRF } = require('./middleware/auth');
const { populate } = require("./profile");
const useragent = require("express-useragent");

var favicon = require('serve-favicon');
app.use(favicon("./public/images/Logo.ico"));

// Add CSP headers
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self'"
    );
    next();
});

app.use(express.static("./public"));
app.use(express.urlencoded({
    extended: false
}));

// For personal setup, create a .env file to store secret OAuth key
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict'
    }
}));

// Temporarily disabled CSRF protection
// Generate CSRF token for all requests
// app.use(generateCSRFToken);

// Protect POST/PUT/DELETE routes with CSRF
// app.use((req, res, next) => {
//     if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
//         validateCSRF(req, res, next);
//     } else {
//         next();
//     }
// });

app.use("/grade", gradeRouter); // Temporarily disabled CSRF protection
app.use("/admin", adminRouter);
app.set('view engine', 'ejs');

// Home page
app.get("/", async (req, res) => {
    let source = req.headers['user-agent'];
    let ua = await(useragent.parse(source));
    if (ua.isMobile) {
        // We don't support functionality on mobile
        req.session.mobile = true;
        res.status(200);
        res.render("phone", {
            loginurl: "/login"
        });
    } else {
        req.session.mobile = false;
        res.status(200).render("index", {
            loginurl: "/login"
        });
    }
});

// Simple login page for local testing
app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", (req, res) => {
    const username = req.body.username;
    // Generate a random ID between 1000000 and 9999999
    const randomId = Math.floor(Math.random() * 9000000) + 1000000;
    // Accept any username, set up session
    req.session.user_data = {
        id: randomId,
        display_name: username,
        ion_username: username
    };
    req.session.loggedin = true;
    req.session.name = username;
    req.session.username = username;
    res.redirect("/grade/profile");
});

// Route to handle first time users
app.get("/start", async (req, res) => {
    res.redirect("/grade/profile");
});

// Post request after first time users receive their information
app.post("/confirm", async (req, res) => {
    res.redirect("/grade/profile");
});

console.log("Application Started");
app.listen(port);
