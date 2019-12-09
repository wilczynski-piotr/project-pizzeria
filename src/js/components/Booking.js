import {select, templates, settings, classNames} from '../settings.js';
import {utils} from '../utils.js';
import AmountWidget from './AmountWidget.js';
import DatePicker from './DatePicker.js';
import HourPicker from './HourPicker.js';

class Booking {
  constructor(bookingWidget) {
    const thisBooking = this;

    thisBooking.render(bookingWidget);
    thisBooking.initWidgets();
    thisBooking.getData();
  }

  render(element) {
    const thisBooking = this;
    const generatedHTML = templates.bookingWidget();

    thisBooking.dom = {};
    thisBooking.dom.wrapper = element;
    thisBooking.dom.wrapper.innerHTML = generatedHTML;
    thisBooking.dom.peopleAmount = thisBooking.dom.wrapper.querySelector(select.booking.peopleAmount);
    thisBooking.dom.hoursAmount = thisBooking.dom.wrapper.querySelector(select.booking.hoursAmount);
    thisBooking.dom.datePicker = thisBooking.dom.wrapper.querySelector(select.widgets.datePicker.wrapper);
    thisBooking.dom.hourPicker = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.wrapper);
    thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(select.booking.tables);
    //thisBooking.formInputs = thisBooking.dom.wrapper.querySelectorAll('input[name=starter]');
  }

  initWidgets() {
    const thisBooking = this;

    thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);
    thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
    thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);
    thisBooking.selectedTable = [];
    thisBooking.starters = [];
    thisBooking.dom.wrapper.addEventListener('updated', function(){
      thisBooking.colorSlider();

      thisBooking.updateDOM();
    });

    thisBooking.submitBooking = thisBooking.dom.wrapper.querySelector(select.booking.bookingSubmit);
    thisBooking.submitBooking.addEventListener('click', function () {
      event.preventDefault();
      if (thisBooking.selectedTable.length == 0) {
        alert('Wybierz stolik!');
      } else {
        thisBooking.sendBooking();
      }
    });
    thisBooking.initBooking();
  }

  getData() {
    const thisBooking = this;

    const startDayParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePicker.minDate);
    const endDayParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePicker.maxDate);

    const params = {
      booking: [
        startDayParam,
        endDayParam
      ],
      eventsCurrent: [
        settings.db.notRepeatParam,
        startDayParam,
        endDayParam
      ],
      eventsRepeat: [
        settings.db.repeatParam,
        endDayParam
      ]
    };

    const urls = {
      booking:       settings.db.url + '/' + settings.db.booking + '?' + params.booking.join('&'),
      eventsCurrent: settings.db.url + '/' + settings.db.event   + '?' + params.eventsCurrent.join('&'),
      eventsRepeat:  settings.db.url + '/' + settings.db.event   + '?' + params.eventsRepeat.join('&')
    };

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat)
    ])
      .then(function(allResponses){
        const bookingsResponse = allResponses[0];
        const eventsCurrentResponse = allResponses[1];
        const eventsRepeatResponse = allResponses[2];
        return Promise.all([
          bookingsResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json()
        ]);
      })
      .then(function([bookings, eventsCurrent, eventsRepeat]){
        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat) {
    const thisBooking = this;

    thisBooking.booked = {};

    for (let item of bookings) {
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    for (let item of eventsCurrent) {
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    const minDate = thisBooking.datePicker.minDate;
    const maxDate = thisBooking.datePicker.maxDate;

    for (let item of eventsRepeat) {
      if (item.repeat == 'daily') {
        for (let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)){
          thisBooking.makeBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
        }
      }
    }
    thisBooking.updateDOM();
    thisBooking.colorSlider();
  }

  makeBooked(date, hour, duration, table) {
    const thisBooking = this;

    if (typeof thisBooking.booked[date] == 'undefined'){
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);

    for (let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5){

      if (typeof thisBooking.booked[date][hourBlock] == 'undefined'){

        thisBooking.booked[date][hourBlock] = [];
      }

      thisBooking.booked[date][hourBlock].push(table);
    }
  }

  updateDOM() {
    const thisBooking = this;

    thisBooking.date = thisBooking.datePicker.value;

    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

    let allAvailable = false;

    if (
      typeof thisBooking.booked[thisBooking.date] == 'undefined'
      ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
    ) {
      allAvailable = true;
    }

    for (let table of thisBooking.dom.tables) {
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);

      if (!isNaN(tableId)) {
        tableId = parseInt(tableId);
      }

      if (
        !allAvailable
        &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)
      ) {
        table.classList.add(classNames.booking.tableBooked);
        table.classList.remove(classNames.booking.selected);

      } else {
        table.classList.remove(classNames.booking.tableBooked);
      }
    }
  }

  initBooking() {
    const thisBooking = this;

    const tables = thisBooking.dom.tables;
    for (let table of tables) {
      table.addEventListener('click', function() {
        event.preventDefault();
        let changeToNumber = table.getAttribute('data-table');
        if (!table.classList.contains(classNames.booking.tableBooked)) {
          table.classList.toggle(classNames.booking.selected);

          if (thisBooking.selectedTable.indexOf(table.getAttribute('data-table')) == -1) {

            thisBooking.selectedTable.push(parseInt(changeToNumber));
          } else {
            thisBooking.selectedTable.splice(thisBooking.selectedTable.indexOf(parseInt(changeToNumber)), 1);
          }
        }
      });
    }

    let datePicker = thisBooking.datePicker.dom.input;
    let hourPicker = thisBooking.hourPicker.dom.input;
    datePicker.addEventListener('change', function() {
      thisBooking.selectedTable.length = 0;
      const tables = document.querySelectorAll('.table');
      tables.forEach(function(el) {
        el.classList.remove('selected');
      });
    });
    hourPicker.addEventListener('change', function() {
      thisBooking.selectedTable.length = 0;
    });
  }

  sendBooking() {
    const thisBooking = this;

    const url = settings.db.url + '/' + settings.db.booking;

    const payload = {
      date: thisBooking.datePicker.value,
      hour: thisBooking.hourPicker.value,
      table: thisBooking.selectedTable,
      repeat: false,
      duration: thisBooking.hoursAmount.value,
      ppl: thisBooking.peopleAmount.value,
      starters: []
    };
    console.log('payload', payload);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    fetch(url, options)
      .then(function (response) {
        return response.json();
      }).then(function () {
      });
    payload.table.forEach(element => {
      thisBooking.makeBooked(payload.date, payload.hour, payload.duration, element);
    });
    thisBooking.updateDOM();
  }

  colorSlider() {
    const thisBooking = this;
    const bookedHours = thisBooking.booked[thisBooking.datePicker.correctValue];
    const sliderElem = document.querySelector('.rangeSlider');
    let newStyle = [];

    for (let bookedHour in bookedHours) {
      const bookingPrecentageStart = ((bookedHour - 12)*100)/12;
      const bookingPrecentageEnd = bookingPrecentageStart + ((0.5 * 100)/12);
      if (bookedHour < 24 ) {
        if (bookedHours[bookedHour].length === 3  ) {
          newStyle.push('/*' + bookedHour + '*/red ' + bookingPrecentageStart + '%, red ' + bookingPrecentageEnd + '%');
        } else if (bookedHours[bookedHour].length === 2) {
          newStyle.push('/*' + bookedHour + '*/orange ' + bookingPrecentageStart + '%, orange ' + bookingPrecentageEnd + '%');
        } else {
          newStyle.push('/*' + bookedHour + '*/green ' + bookingPrecentageStart + '%, green ' + bookingPrecentageEnd + '%');
        }
      }
    }

    newStyle.sort();
    let newStyleCssString = newStyle.join();
    let newStyleCssStringSum = 'linear-gradient(to right, ' + newStyleCssString + ')';
    sliderElem.style.background = newStyleCssStringSum;
  }
}

export default Booking;
