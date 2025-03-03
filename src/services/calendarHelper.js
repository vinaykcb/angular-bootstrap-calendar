'use strict';

var angular = require('angular');
var calendarUtils = require('calendar-utils');

angular
  .module('mwl.calendar')
  .factory('calendarHelper', function($q, $templateRequest, dateFilter, moment, calendarConfig) {

    function formatDate(date, format) {
      if (calendarConfig.dateFormatter === 'angular') {
        return dateFilter(moment(date).toDate(), format);
      } else if (calendarConfig.dateFormatter === 'moment') {
        return moment(date).format(format);
      } else {
        throw new Error('Unknown date formatter: ' + calendarConfig.dateFormatter);
      }
    }

    function adjustEndDateFromStartDiff(oldStart, newStart, oldEnd) {
      if (!oldEnd) {
        return oldEnd;
      }
      var diffInSeconds = moment(newStart).diff(moment(oldStart));
      return moment(oldEnd).add(diffInSeconds);
    }

    function getRecurringEventPeriod(eventPeriod, recursOn, containerPeriodStart) {

      var eventStart = moment(eventPeriod.start);
      var eventEnd = moment(eventPeriod.end);
      var periodStart = moment(containerPeriodStart);

      if (recursOn) {

        switch (recursOn) {
          case 'year':
            eventStart.set({
              year: periodStart.year()
            });
            break;

          case 'month':
            eventStart.set({
              year: periodStart.year(),
              month: periodStart.month()
            });
            break;

          default:
            throw new Error('Invalid value (' + recursOn + ') given for recurs on. Can only be year or month.');
        }

        eventEnd = adjustEndDateFromStartDiff(eventPeriod.start, eventStart, eventEnd);

      }

      return {start: eventStart, end: eventEnd};

    }

    function eventIsInPeriod(event, periodStart, periodEnd) {

      periodStart = moment(periodStart);
      periodEnd = moment(periodEnd);

      var eventPeriod = getRecurringEventPeriod({start: event.startsAt, end: event.endsAt || event.startsAt}, event.recursOn, periodStart);
      var eventStart = eventPeriod.start;
      var eventEnd = eventPeriod.end;

      return (eventStart.isAfter(periodStart) && eventStart.isBefore(periodEnd)) ||
        (eventEnd.isAfter(periodStart) && eventEnd.isBefore(periodEnd)) ||
        (eventStart.isBefore(periodStart) && eventEnd.isAfter(periodEnd)) ||
        eventStart.isSame(periodStart) ||
        eventEnd.isSame(periodEnd);

    }

    function filterEventsInPeriod(events, startPeriod, endPeriod) {
      return events.filter(function(event) {
        return eventIsInPeriod(event, startPeriod, endPeriod);
      });
    }

    function getEventsInPeriod(calendarDate, period, allEvents) {
      var startPeriod = moment(calendarDate).startOf(period);
      var endPeriod = moment(calendarDate).endOf(period);
      return filterEventsInPeriod(allEvents, startPeriod, endPeriod);
    }

    function getBadgeTotal(events) {
      return events.filter(function(event) {
        return event.incrementsBadgeTotal !== false;
      }).length;
    }

    function getWeekDayNames(excluded) {
      var weekdays = [0, 1, 2, 3, 4, 5, 6]
      .filter(function(wd) {
        return !(excluded || []).some(function(ex) {
          return ex === wd;
        });
      })
      .map(function(i) {
        return formatDate(moment().weekday(i), calendarConfig.dateFormats.weekDay);
      });

      return weekdays;
    }

    function getYearView(events, viewDate, cellModifier) {

      var view = [];
      var eventsInPeriod = getEventsInPeriod(viewDate, 'year', events);
      var month = moment(viewDate).startOf('year');
      var count = 0;
      while (count < 12) {
        var startPeriod = month.clone();
        var endPeriod = startPeriod.clone().endOf('month');
        var periodEvents = filterEventsInPeriod(eventsInPeriod, startPeriod, endPeriod);
        var cell = {
          label: formatDate(startPeriod, calendarConfig.dateFormats.month),
          isToday: startPeriod.isSame(moment().startOf('month')),
          events: periodEvents,
          date: startPeriod,
          badgeTotal: getBadgeTotal(periodEvents)
        };

        cellModifier({calendarCell: cell});
        view.push(cell);
        month.add(1, 'month');
        count++;
      }

      return view;

    }

    function updateEventForCalendarUtils(event, eventPeriod) {
      event.start = eventPeriod.start.toDate();
      if (event.endsAt) {
        event.end = eventPeriod.end.toDate();
      }
      return event;
    }

    function getMonthView(events, viewDate, cellModifier, excluded) {

      // hack required to work with the calendar-utils api
      events.forEach(function(event) {
        var eventPeriod = getRecurringEventPeriod({
          start: moment(event.startsAt),
          end: moment(event.endsAt || event.startsAt)
        }, event.recursOn, moment(viewDate).startOf('month'));
        updateEventForCalendarUtils(event, eventPeriod);
      });

      var view = calendarUtils.getMonthView({
        events: events,
        viewDate: viewDate,
        excluded: excluded,
        weekStartsOn: moment().startOf('week').day()
      });

      view.days = view.days.map(function(day) {
        day.date = moment(day.date);
        day.label = day.date.date();
        day.badgeTotal = getBadgeTotal(day.events);
        if (!calendarConfig.displayAllMonthEvents && !day.inMonth) {
          day.events = [];
        }
        cellModifier({calendarCell: day});
        return day;
      });

      // remove hack
      events.forEach(function(event) {
        delete event.start;
        delete event.end;
      });

      return view;

    }

    function getWeekView(events, viewDate, excluded) {

      var days = calendarUtils.getWeekViewHeader({
        viewDate: viewDate,
        excluded: excluded,
        weekStartsOn: moment().startOf('week').day()
      }).map(function(day) {
        day.date = moment(day.date);
        day.weekDayLabel = formatDate(day.date, calendarConfig.dateFormats.weekDay);
        day.dayLabel = formatDate(day.date, calendarConfig.dateFormats.day);
        return day;
      });

      var startOfWeek = moment(viewDate).startOf('week');
      var endOfWeek = moment(viewDate).endOf('week');

      var eventRows = calendarUtils.getWeekView({
        viewDate: viewDate,
        weekStartsOn: moment().startOf('week').day(),
        excluded: excluded,
        events: filterEventsInPeriod(events, startOfWeek, endOfWeek).map(function(event) {

          var weekViewStart = moment(startOfWeek).startOf('day');

          var eventPeriod = getRecurringEventPeriod({
            start: moment(event.startsAt),
            end: moment(event.endsAt || event.startsAt)
          }, event.recursOn, weekViewStart);

          var calendarUtilsEvent = {
            originalEvent: event,
            start: eventPeriod.start.toDate()
          };

          if (event.endsAt) {
            calendarUtilsEvent.end = eventPeriod.end.toDate();
          }

          return calendarUtilsEvent;
        })
      }).eventRows.map(function(eventRow) {

        eventRow.row = eventRow.row.map(function(rowEvent) {
          rowEvent.event = rowEvent.event.originalEvent;
          return rowEvent;
        });

        return eventRow;

      });

      return {days: days, eventRows: eventRows};

    }

    function getDayView(events, viewDate, dayViewStart, dayViewEnd, dayViewSplit, dayViewEventWidth, dayViewSegmentSize) {

      var dayStart = (dayViewStart || '00:00').split(':');
      var dayEnd = (dayViewEnd || '23:59').split(':');

      var view = calendarUtils.getDayView({
        events: events.map(function(event) { // hack required to work with event API
          var eventPeriod = getRecurringEventPeriod({
            start: moment(event.startsAt),
            end: moment(event.endsAt || event.startsAt)
          }, event.recursOn, moment(viewDate).startOf('day'));
          return updateEventForCalendarUtils(event, eventPeriod);
        }),
        viewDate: viewDate,
        hourSegments: 60 / dayViewSplit,
        dayStart: {
          hour: dayStart[0],
          minute: dayStart[1]
        },
        dayEnd: {
          hour: dayEnd[0],
          minute: dayEnd[1]
        },
        eventWidth: dayViewEventWidth ? +dayViewEventWidth : 150,
        segmentHeight: dayViewSegmentSize || 30
      });

      // remove hack to work with new event API
      events.forEach(function(event) {
        delete event.start;
        delete event.end;
      });

      return view;

    }

    function getWeekViewWithTimes(events, viewDate, dayViewStart, dayViewEnd, dayViewSplit) {
      var weekView = getWeekView(events, viewDate);
      var newEvents = [];
      var flattenedEvents = [];
      weekView.eventRows.forEach(function(row) {
        row.row.forEach(function(eventRow) {
          flattenedEvents.push(eventRow.event);
        });
      });
      weekView.days.forEach(function(day) {
        var dayEvents = flattenedEvents.filter(function(event) {
          return moment(event.startsAt).startOf('day').isSame(moment(day.date).startOf('day'));
        });
        var splitedEvents = {};
        dayEvents.forEach(function(anEvent) {
          if (!splitedEvents[anEvent.startsAt]) {
            splitedEvents[anEvent.startsAt] = [];
          }
          splitedEvents[anEvent.startsAt].push(anEvent);
        });
        for (var key in splitedEvents) {
          var newDayEvents = getDayView(
            splitedEvents[key],
            day.date,
            dayViewStart,
            dayViewEnd,
            dayViewSplit,
            150 / splitedEvents[key].length
          ).events;
          for (var i = 0; i < newDayEvents.length; i++) {
            newDayEvents[i].count = newDayEvents.length;
          }
          newEvents = newEvents.concat(newDayEvents);
        }
      });
      weekView.eventRows = [{
        row: newEvents.map(function(dayEvent) {
          var event = dayEvent.event;
          return {
            event: event,
            top: dayEvent.top,
            left: dayEvent.left,
            count: dayEvent.count,
            offset: calendarUtils.getWeekViewEventOffset({
              event: {
                start: event.startsAt,
                end: event.endsAt
              },
              startOfWeek: moment(viewDate).startOf('week').toDate()
            })
          };
        })
      }];
      return weekView;
    }

    function getDayViewHeight(dayViewStart, dayViewEnd, dayViewSplit, dayViewSegmentSize) {
      var dayViewStartM = moment(dayViewStart || '00:00', 'HH:mm');
      var dayViewEndM = moment(dayViewEnd || '23:59', 'HH:mm');
      var hourHeight = (60 / dayViewSplit) * (dayViewSegmentSize || 30);
      return ((dayViewEndM.diff(dayViewStartM, 'minutes') / 60) * hourHeight) + 3;
    }

    function loadTemplates() {

      var templatePromises = Object.keys(calendarConfig.templates).map(function(key) {
        var templateUrl = calendarConfig.templates[key];
        return $templateRequest(templateUrl);
      });

      return $q.all(templatePromises);

    }

    return {
      getWeekDayNames: getWeekDayNames,
      getYearView: getYearView,
      getMonthView: getMonthView,
      getWeekView: getWeekView,
      getDayView: getDayView,
      getWeekViewWithTimes: getWeekViewWithTimes,
      getDayViewHeight: getDayViewHeight,
      adjustEndDateFromStartDiff: adjustEndDateFromStartDiff,
      formatDate: formatDate,
      loadTemplates: loadTemplates,
      eventIsInPeriod: eventIsInPeriod //expose for testing only
    };

  });
