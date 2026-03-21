const mongoose = require("mongoose"); // 🔥 MISSING LINE (IMPORTANT)

const userSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String,
        unique: true
    },
    number: String,
    password: String
});

module.exports = mongoose.model("User", userSchema);