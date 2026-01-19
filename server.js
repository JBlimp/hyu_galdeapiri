const express = require("express");
const path = require("path");
const fs = require("fs");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "bookings.sqlite");

let db;

const ensureDb = async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    create table if not exists bookings (
      id text primary key,
      team_name text not null,
      date text not null,
      start_time text not null,
      end_time text not null,
      duration integer not null,
      start_minutes integer not null,
      end_minutes integer not null,
      created_at text not null
    );
  `);
};

const parseTimeToMinutes = (value) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const isWithinWindow = (dateValue) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${dateValue}T00:00:00`);
  const max = new Date(start);
  max.setDate(start.getDate() + 7);
  return target >= start && target <= max;
};

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/api/bookings", async (_req, res) => {
  const rows = await db.all(
    "select * from bookings order by date asc, start_minutes asc"
  );
  const bookings = rows.map((row) => ({
    id: row.id,
    teamName: row.team_name,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
  }));
  res.json(bookings);
});

app.post("/api/bookings", async (req, res) => {
  const { teamName, date, startTime, duration } = req.body || {};

  if (!teamName || !date || !startTime || !duration) {
    return res.status(400).json({ message: "모든 항목을 입력해 주세요." });
  }

  if (String(teamName).trim().length > 50) {
    return res.status(400).json({ message: "팀 이름은 50자 이내로 입력해 주세요." });
  }

  if (!isWithinWindow(date)) {
    return res.status(400).json({ message: "예약은 오늘부터 7일 이내만 가능합니다." });
  }

  const durationNumber = Number(duration);
  if (!Number.isFinite(durationNumber) || durationNumber <= 0 || durationNumber > 120) {
    return res.status(400).json({ message: "최대 2시간(120분)까지만 예약 가능합니다." });
  }

  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes === null) {
    return res.status(400).json({ message: "시작 시간이 올바르지 않습니다." });
  }

  const endMinutes = startMinutes + durationNumber;
  if (endMinutes > 24 * 60) {
    return res.status(400).json({ message: "종료 시간이 자정을 넘을 수 없습니다." });
  }

  const conflict = await db.get(
    `select id from bookings
     where date = ?
       and start_minutes < ?
       and end_minutes > ?
     limit 1`,
    [date, endMinutes, startMinutes]
  );

  if (conflict) {
    return res.status(409).json({ message: "해당 시간에 이미 예약이 있습니다." });
  }

  const id = randomUUID();
  const endTime = formatMinutesToTime(endMinutes);
  const createdAt = new Date().toISOString();

  await db.run(
    `insert into bookings (id, team_name, date, start_time, end_time, duration, start_minutes, end_minutes, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, teamName.trim(), date, startTime, endTime, durationNumber, startMinutes, endMinutes, createdAt]
  );

  res.status(201).json({
    id,
    teamName: teamName.trim(),
    date,
    startTime,
    endTime,
    duration: durationNumber,
    startMinutes,
    endMinutes,
  });
});

app.delete("/api/bookings/:id", async (req, res) => {
  const { id } = req.params;
  await db.run("delete from bookings where id = ?", [id]);
  res.status(204).send();
});

app.delete("/api/bookings", async (_req, res) => {
  await db.run("delete from bookings");
  res.status(204).send();
});

ensureDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
