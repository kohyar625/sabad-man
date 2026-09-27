document.addEventListener("DOMContentLoaded", function () {

  const status = document.getElementById("status");

  try {

    status.textContent = "در حال آماده‌سازی سیستم ورود...";

    if (typeof supabase === "undefined") {
      status.textContent = "خطا: کتابخانه Supabase بارگذاری نشده";
      return;
    }

    if (typeof SUPABASE_URL === "undefined") {
      status.textContent = "خطا: SUPABASE_URL پیدا نشد";
      return;
    }

    if (typeof SUPABASE_ANON_KEY === "undefined") {
      status.textContent = "خطا: SUPABASE_ANON_KEY پیدا نشد";
      return;
    }

    const db = supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const login = document.getElementById("loginButton");
    const products = document.getElementById("products");
    const totalSales = document.getElementById("totalSales");

    if (!email || !password || !login) {
      status.textContent =
        "خطا: بخش ورود در صفحه پیدا نشد";
      return;
    }

    status.textContent = "سیستم ورود آماده است ✅";


    login.onclick = async function () {

      status.textContent = "در حال ورود...";

      login.disabled = true;

      const emailValue = email.value.trim();
      const passwordValue = password.value;

      if (!emailValue || !passwordValue) {

        status.textContent =
          "ایمیل و رمز عبور را وارد کنید.";

        login.disabled = false;

        return;
      }

      try {

        const result =
          await db.auth.signInWithPassword({

            email: emailValue,

            password: passwordValue

          });


        if (result.error) {

          status.textContent =
            "خطا: " + result.error.message;

          login.disabled = false;

          return;
        }


        status.textContent =
          "ورود موفق بود ✅";


        document.getElementById(
          "loginBox"
        ).style.display = "none";


        showTeaProduct();


      } catch (error) {

        status.textContent =
          "خطای اتصال: " + error.message;

        login.disabled = false;

        console.error(error);
      }

    };


    function showTeaProduct() {

      let teaQuantity = 0;
      let selectedDate = new Date();

      products.innerHTML =

        '<div style="padding:20px;">' +

        '<h2>🍵 چایی</h2>' +

        '<p>قیمت هر چایی: <strong>۳۰٬۰۰۰ تومان</strong></p>' +

        '<hr>' +

        '<h3>تقویم شمسی</h3>' +

        '<div id="calendarDate" style="font-size:20px;font-weight:bold;margin:15px 0;"></div>' +

        '<button id="prevDay">روز قبل</button> ' +

        '<button id="todayButton">امروز</button> ' +

        '<button id="nextDay">روز بعد</button>' +

        '<br><br>' +

        '<button id="selectDateButton">انتخاب این تاریخ</button>' +

        '<p>تاریخ انتخاب‌شده: <strong id="selectedDate">انتخاب نشده</strong></p>' +

        '<hr>' +

        '<h3>تعداد فروش</h3>' +

        '<button id="minusButton">−</button>' +

        '<span id="quantity" style="display:inline-block;min-width:50px;text-align:center;font-size:20px;font-weight:bold;">۰</span>' +

        '<button id="plusButton">+</button>' +

        '</div>';


      function updateCalendar() {

        document.getElementById(
          "calendarDate"
        ).textContent =

          new Intl.DateTimeFormat(
            "fa-IR-u-ca-persian",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            }
          ).format(selectedDate);

      }


      function updateTea() {

        document.getElementById(
          "quantity"
        ).textContent =
          teaQuantity.toLocaleString("fa-IR");


        totalSales.textContent =
          "فروش امروز: " +
          (teaQuantity * 30000)
            .toLocaleString("fa-IR") +
          " تومان";
      }


      document.getElementById(
        "plusButton"
      ).onclick = function () {

        teaQuantity++;

        updateTea();
