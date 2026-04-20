const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        default: "General"
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
});

function createTeacherModel(connection) {
    return connection.models.Teacher || connection.model("Teacher", teacherSchema);
}

module.exports = createTeacherModel;
