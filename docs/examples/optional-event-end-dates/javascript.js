'use strict';
angular
  .module('mwl.calendar.docs')
  .controller('OptionalEventEndDatesCtrl', function(moment, calendarConfig) {

    var vm = this;
    calendarConfig.showTimesOnWeekView = true;

    vm.events = [{
      title: '1',
      startsAt: moment().hours(3).minutes(0).toDate(),
      color: calendarConfig.colorTypes.info
    }, {
      title: '2',
      startsAt: moment().hours(3).minutes(0).toDate(),
      color: calendarConfig.colorTypes.warning
    }, {
      title: '3',
      startsAt: moment().hours(3).minutes(0).toDate(),
      color: calendarConfig.colorTypes.warning
    }, {
      title: '4',
      startsAt: moment().hours(4).minutes(0).toDate(),
      color: calendarConfig.colorTypes.warning
    }];

    vm.calendarView = 'day';
    vm.viewDate = new Date();

  });
