// imports
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const User = require("./models/user");

const app = express();
const PORT = 8000;

// middleware
app.use(express.urlencoded({ extended: true }));



// 🔥 session setup
app.use(session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: false // ⚠️ IMPORTANT FIX
}));

// 🔥 THEN locals middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 🔥 MongoDB connect
mongoose.connect("mongodb://127.0.0.1:27017/e_learning")
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log(err));


// 🔒 AUTH MIDDLEWARE (FINAL)
function isAuth(req, res, next) {
    if (req.session && req.session.user && req.session.user._id) {
        return next();
    }
    return res.redirect("/login");
}


// ================= ROUTES =================

// ❌ Protected route
app.get("/", isAuth, (req, res) => {
    console.log("SESSION:", req.session); // 👈 ADD THIS
    res.render("home", { title: "Home" });
});

// public routes
app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/login", (req, res) => {
    res.render("login");
});


// 🔥 REGISTER
app.post("/register", async (req, res) => {
    let { name, email, number, password } = req.body;

    email = email.trim();

    try {
        // 🔥 check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.render("register", {
                error: "Email already registered ❌"
            });
        }

        const user = new User({
            name,
            email,
            number,
            password
        });

        await user.save();

        res.redirect("/login?success=1");

    } catch (err) {
        console.log(err);
        res.send("Error in Register ❌");
    }
});

// 🔥 LOGIN
app.post("/login", async (req, res) => {
    let { email, password } = req.body;

    email = email.trim();
    password = password.trim();

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.render("login", {
                error: "User not found ❌"
            });
        }

        if (user.password !== password) {
            return res.render("login", {
                error: "Wrong password ❌"
            });
        }

        req.session.user = user;
        return res.redirect("/");

    } catch (err) {
        console.log(err);
        res.send("Error in Login ❌");
    }
});


// 🔥 LOGOUT
app.get("/logout", (req, res) => {
    console.log("Logout route hit ✅");
    req.session.destroy(() => {
        res.redirect("/login");
    });
});


// server start
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});