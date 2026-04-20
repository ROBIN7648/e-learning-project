// imports
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");
const User = require("./models/user");
const Feedback = require("./models/feedback");
const createTeacherModel = require("./models/teacher");

const app = express();
const PORT = 8000;

// middleware
app.use(express.urlencoded({ extended: true }));

// session
app.use(session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: false
}));

// user for navbar
app.use((req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    res.locals.teacher = req.session ? req.session.teacher : null;
    next();
});

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// DB connect
mongoose.connect("mongodb://127.0.0.1:27017/e_learning")
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log(err));

const teacherConnection = mongoose.createConnection("mongodb://127.0.0.1:27017/e_learning_teachers");
teacherConnection
    .asPromise()
    .then(() => console.log("Teacher DB Connected ✅"))
    .catch(err => console.log(err));

const Teacher = createTeacherModel(teacherConnection);


function isAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.redirect("/login");
}

function isTeacherAuth(req, res, next) {
    if (req.session && req.session.teacher) {
        return next();
    }
    return res.redirect("/teacher/login");
}

function renderProtectedPage(view, title) {
    return (req, res) => {
        res.render(view, {
            title,
            user: req.session.user
        });
    };
}

// ================= ROUTES =================

// home (optional)
app.get("/", (req, res) => {
    res.render("home", { title: "Home" });
});

// dashboard (main protected page)
app.get("/dashboard", isAuth, (req, res) => {
    res.render("dashboard", {
        user: req.session.user,
        enrollment: req.session.enrollment || null
    });
});

// enroll course (simple session-based)
app.post("/enroll", isAuth, (req, res) => {
    const { course, schedule, live } = req.body;

    req.session.enrollment = {
        course: course || "",
        schedule: schedule || "",
        live: live || ""
    };

    res.redirect("/dashboard");
});

// teacher dashboard (separate DB)
app.get("/teacher/dashboard", isTeacherAuth, async (req, res) => {
    try {
        const sessionTeacher = req.session.teacher;
        const teacher = await Teacher.findOne({ email: sessionTeacher.email });

        if (!teacher) {
            return res.redirect("/teacher/login");
        }

        res.render("teacherDashboard", {
            teacher
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading teacher dashboard");
    }
});

app.get("/courses", isAuth, renderProtectedPage("courses", "Courses"));
app.get("/live", isAuth, renderProtectedPage("live", "Live Classes"));
app.get("/timeTable", isAuth, renderProtectedPage("timeTable", "Time Table"));
app.get("/upComing", isAuth, renderProtectedPage("upComing", "Upcoming Classes"));

// register page
app.get("/register", (req, res) => {
    if (req.session.teacher) {
        return res.redirect("/teacher/dashboard");
    }
    if (req.session.user) {
        return res.redirect("/dashboard");
    }
    res.render("register");
});

// teacher register page
app.get("/teacher/register", (req, res) => {
    if (req.session.teacher) {
        return res.redirect("/teacher/dashboard");
    }
    res.render("teacherRegister");
});

// login page
app.get("/login", (req, res) => {
    if (req.session.teacher) {
        return res.redirect("/teacher/dashboard");
    }
    if (req.session.user) {
        return res.redirect("/dashboard");
    }
    res.render("login");
});

// teacher login page
app.get("/teacher/login", (req, res) => {
    if (req.session.teacher) {
        return res.redirect("/teacher/dashboard");
    }
    res.render("teacherLogin");
});

// 🔐 REGISTER
app.post("/register", async (req, res) => {
    let { name, email, number, password, role, subject } = req.body;

    name = name.trim();
    email = email.trim();
    password = password.trim();
    role = role ? role.trim() : "student";
    subject = subject ? subject.trim() : "General";
    number = number ? number.trim() : "";

    if (!name || !email || !password) {
        return res.render("register", {
            error: "All fields required "
        });
    }

    try {
        if (role === "teacher") {
            const existingTeacher = await Teacher.findOne({ email });

            if (existingTeacher) {
                return res.render("register", {
                    error: "Email already registered "
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const teacher = new Teacher({
                name,
                email,
                subject: subject || "General",
                password: hashedPassword
            });

            await teacher.save();

            req.session.teacher = teacher;
            return res.redirect("/teacher/dashboard");
        }

        if (!number) {
            return res.render("register", {
                error: "Mobile number required for students "
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.render("register", {
                error: "Email already registered "
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            number,
            password: hashedPassword
        });

        await user.save();

        res.redirect("/login?success=1");

    } catch (err) {
        console.log(err);
        res.send("Error in Register ");
    }
});

//  LOGIN
app.post("/login", async (req, res) => {
    let { email, password, role } = req.body;

    email = email.trim();
    password = password.trim();
    role = role ? role.trim() : "student";

    try {
        if (role === "teacher") {
            const teacher = await Teacher.findOne({ email });

            if (!teacher) {
                return res.render("login", {
                    error: "Teacher not found "
                });
            }

            const isMatch = await bcrypt.compare(password, teacher.password);

            if (!isMatch) {
                return res.render("login", {
                    error: "Wrong password "
                });
            }

            req.session.teacher = teacher;
            return res.redirect("/teacher/dashboard");
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.render("login", {
                error: "User not found "
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.render("login", {
                error: "Wrong password "
            });
        }

        req.session.user = user;
        return res.redirect("/dashboard");

    } catch (err) {
        console.log(err);
        res.send("Error in Login ");
    }
});

// logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});


// feedback page
app.get("/feedback", (req, res) => {
    res.render("feedback");
});

// submit feedback
app.post("/feedback", async (req, res) => {
    let { name, email, message } = req.body;

    name = name.trim();
    email = email.trim();
    message = message.trim();

    if (!name || !email || !message) {
        return res.render("feedback", {
            error: "All fields required ❌"
        });
    }

    try {
        const newFeedback = new Feedback({ name, email, message });
        await newFeedback.save();

        res.render("feedback", {
            success: "Feedback submitted successfully "
        });

    } catch (err) {
        console.log(err);
        res.send("Error ❌");
    }
});


app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/contact", (req, res) => {
    res.render("contact");
});

// server start
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// 🔐 TEACHER REGISTER
app.post("/teacher/register", async (req, res) => {
    let { name, email, subject, password } = req.body;

    name = name.trim();
    email = email.trim();
    subject = subject ? subject.trim() : "General";
    password = password.trim();

    if (!name || !email || !password) {
        return res.render("teacherRegister", {
            error: "All fields required "
        });
    }

    try {
        const existingTeacher = await Teacher.findOne({ email });

        if (existingTeacher) {
            return res.render("teacherRegister", {
                error: "Email already registered "
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const teacher = new Teacher({
            name,
            email,
            subject: subject || "General",
            password: hashedPassword
        });

        await teacher.save();

        req.session.teacher = teacher;
        res.redirect("/teacher/dashboard");

    } catch (err) {
        console.log(err);
        res.send("Error in Teacher Register ");
    }
});

//  TEACHER LOGIN
app.post("/teacher/login", async (req, res) => {
    let { email, password } = req.body;

    email = email.trim();
    password = password.trim();

    try {
        const teacher = await Teacher.findOne({ email });

        if (!teacher) {
            return res.render("teacherLogin", {
                error: "Teacher not found "
            });
        }

        const isMatch = await bcrypt.compare(password, teacher.password);

        if (!isMatch) {
            return res.render("teacherLogin", {
                error: "Wrong password "
            });
        }

        req.session.teacher = teacher;
        return res.redirect("/teacher/dashboard");

    } catch (err) {
        console.log(err);
        res.send("Error in Teacher Login ");
    }
});