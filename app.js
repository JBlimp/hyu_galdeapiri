const form = document.getElementById("booking-form");
const helper = document.getElementById("helper");
const calendar = document.getElementById("calendar");
const weekRange = document.getElementById("week-range");
const calendarDayTemplate = document.getElementById("calendar-day-template");
const calendarItemTemplate = document.getElementById("calendar-item-template");
const prevWeekButton = document.getElementById("prev-week");
const nextWeekButton = document.getElementById("next-week");
const calendarTitle = document.getElementById("calendar-title");

const teamNameInput = document.getElementById("team-name");
const dateInput = document.getElementById("date");
const startTimeInput = document.getElementById("start-time");
const durationInput = document.getElementById("duration");
const passwordInput = document.getElementById("password");

const pad = (value) => String(value).padStart(2, "0");

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const formatMonthDay = (date) => {
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${pad(hours)}:${pad(mins)}`;
};

const getWeekOfMonth = (date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = firstDay.getDay();
  return Math.floor((date.getDate() + offset - 1) / 7) + 1;
};

const showMessage = (message, isError = true) => {
  helper.textContent = message;
  helper.style.color = isError ? "#ef4444" : "#10b981";
};

const setDateLimits = () => {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 7);

  const todayString = formatDate(today);
  const maxString = formatDate(maxDate);

  dateInput.min = todayString;
  dateInput.max = maxString;

  if (!dateInput.value) {
    dateInput.value = todayString;
  }
};

const isWithinWindow = (dateValue) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${dateValue}T00:00:00`);
  const max = new Date(start);
  max.setDate(start.getDate() + 7);
  return target >= start && target <= max;
};

const hasConflict = (bookings, date, startMinutes, endMinutes) => {
  return bookings.some((booking) => {
    if (booking.date !== date) return false;
    const existingStart = booking.startMinutes;
    const existingEnd = booking.endMinutes;
    return startMinutes < existingEnd && endMinutes > existingStart;
  });
};

const fetchAllBookings = async () => {
  const response = await fetch("/api/bookings");
  if (!response.ok) {
    throw new Error("failed");
  }
  return response.json();
};

const createBooking = async (payload) => {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "예약 실패" }));
    throw new Error(error.message || "예약 실패");
  }
  return response.json();
};

const deleteBooking = async (id, password) => {
  const response = await fetch(`/api/bookings/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "삭제 실패" }));
    throw new Error(error.message || "삭제 실패");
  }
};

let weekOffset = 0;

const renderCalendar = (bookings) => {
  calendar.innerHTML = "";
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  weekRange.textContent = `${formatMonthDay(start)} ~ ${formatMonthDay(end)}`;
  const weekOfMonth = getWeekOfMonth(start);
  calendarTitle.textContent = `${start.getMonth() + 1}월 ${weekOfMonth}주차 캘린더`;

  const grouped = bookings.reduce((acc, booking) => {
    if (!acc[booking.date]) acc[booking.date] = [];
    acc[booking.date].push(booking);
    return acc;
  }, {});

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateKey = formatDate(date);
    const dayNode = calendarDayTemplate.content.cloneNode(true);
    const dayHeader = dayNode.querySelector(".calendar-day-header");
    const slots = dayNode.querySelector(".calendar-slots");

    dayHeader.textContent = `${formatMonthDay(date)} (${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]})`;

    const dayBookings = (grouped[dateKey] || []).sort(
      (a, b) => a.startMinutes - b.startMinutes
    );

    if (dayBookings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "calendar-item empty";
      empty.textContent = "예약 없음";
      slots.appendChild(empty);
    } else {
      dayBookings.forEach((booking) => {
        const itemNode = calendarItemTemplate.content.cloneNode(true);
        itemNode.querySelector(".calendar-title").textContent = booking.teamName;
        itemNode.querySelector(".calendar-time").textContent = `${booking.startTime} ~ ${booking.endTime}`;
        const deleteButton = itemNode.querySelector(".calendar-delete");

        deleteButton.addEventListener("click", async () => {
          if (!confirm("이 예약을 삭제할까요?")) return;
          const password = prompt("삭제 비밀번호를 입력해 주세요.");
          if (!password) return;
          try {
            await deleteBooking(booking.id, password.trim());
            await refreshBookings();
            showMessage("예약이 삭제되었습니다.", false);
          } catch (error) {
            showMessage(error.message || "삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
          }
        });

        slots.appendChild(itemNode);
      });
    }

    calendar.appendChild(dayNode);
  }
};

const refreshBookings = async () => {
  try {
    const allBookings = await fetchAllBookings();
    renderCalendar(allBookings);
  } catch (error) {
    showMessage("예약 목록을 불러오지 못했습니다. 서버 상태를 확인해 주세요.");
  }
};

prevWeekButton.addEventListener("click", () => {
  weekOffset -= 1;
  refreshBookings();
});

nextWeekButton.addEventListener("click", () => {
  weekOffset += 1;
  refreshBookings();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  helper.textContent = "";

  const teamName = teamNameInput.value.trim();
  const dateValue = dateInput.value;
  const startTime = startTimeInput.value;
  const duration = Number(durationInput.value);
  const password = passwordInput.value.trim();

  if (!teamName || !dateValue || !startTime || !duration || !password) {
    showMessage("모든 항목을 입력해 주세요.");
    return;
  }

  if (password.length < 4 || password.length > 20) {
    showMessage("비밀번호는 4~20자리로 입력해 주세요.");
    return;
  }

  if (!isWithinWindow(dateValue)) {
    showMessage("예약은 오늘부터 7일 이내 날짜만 가능합니다.");
    return;
  }

  if (duration > 120) {
    showMessage("최대 2시간(120분)까지만 예약 가능합니다.");
    return;
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + duration;

  if (endMinutes > 24 * 60) {
    showMessage("종료 시간이 자정을 넘을 수 없습니다.");
    return;
  }

  try {
    const existing = await fetchAllBookings();
    if (hasConflict(existing, dateValue, startMinutes, endMinutes)) {
      showMessage("해당 시간에 이미 예약이 있습니다.");
      return;
    }

    await createBooking({
      teamName,
      date: dateValue,
      startTime,
      duration,
      password,
    });

    showMessage("예약이 완료되었습니다.", false);
    form.reset();
    setDateLimits();
    await refreshBookings();
  } catch (error) {
    showMessage(error.message || "예약에 실패했습니다.");
  }
});

setDateLimits();
refreshBookings();
