/*!
 * base.js
 * @author ydr.me
 * 2014-09-21 15:04
 */


define(function (require, exports, module) {
    /**
     * @module core/event/base
     * @requires util/dato
     * @requires util/typeis
     * @requires core/dom/selector
     */
    'use strict';

    var dato = require('../../util/dato.js');
    var typeis = require('../../util/typeis.js');
    var domSelector = require('../dom/selector.js');
    var regSpace = /\s+/g;
    // 原始事件：用户传入的事件
    // {
    //     1: {
    //         "click": [],
    //         "mouseover": [],
    //         ...
    //     }
    // }
    var unCaptureOriginalListeners = {};
    var isCaptureOriginalListeners = {};
    // 实际事件：运算后的事件
    var unCaptureActualListeners = {};
    var isCaptureActualListeners = {};
    // 真实事件：真正处于监听的事件
    var unCaptureRealListeners = {};
    var isCaptureRealListeners = {};
    var domId = 0;
    var key = 'alien-core-event-base';
    var defaults = {
        // 是否冒泡
        bubbles: !0,
        // 是否可以被阻止冒泡
        cancelable: !0,
        // 事情细节
        detail: {}
    };

    /**
     * @link http://www.w3school.com.cn/jsref/dom_obj_event.asp
     * - altKey            返回当事件被触发时，"ALT" 是否被按下。
     * - button            返回当事件被触发时，哪个鼠标按钮被点击。
     * - clientX        返回当事件被触发时，鼠标指针的水平坐标。
     * - clientY        返回当事件被触发时，鼠标指针的垂直坐标。
     * - ctrlKey        返回当事件被触发时，"CTRL" 键是否被按下。
     * - metaKey        返回当事件被触发时，"meta" 键是否被按下。
     * - relatedTarget    返回与事件的目标节点相关的节点。
     * - screenX        返回当某个事件被触发时，鼠标指针的水平坐标。
     * - screenY        返回当某个事件被触发时，鼠标指针的垂直坐标。
     * - shiftKey        返回当事件被触发时，"SHIFT" 键是否被按下。
     * - bubbles        返回布尔值，指示事件是否是起泡事件类型。
     * - cancelable        返回布尔值，指示事件是否可拥可取消的默认动作。
     * - currentTarget    返回其事件监听器触发该事件的元素。
     * - eventPhase        返回事件传播的当前阶段。0=结束或未开始，1=捕获，2=到底，3=冒泡
     * - target            返回触发此事件的元素（事件的目标节点）。
     * - timeStamp        返回事件生成的日期和时间。
     * - type            返回当前 Event 对象表示的事件的名称。
     */
    var mustEventProperties = 'altKey button which clientX clientY ctrlKey metaKey relatedTarget pageX pageY screenX screenY shiftKey bubbles cancelable currentTaget eventPhase target timeStamp'.split(' ');
    var eventTypeArr = ['Events', 'HTMLEvents', 'MouseEvents', 'UIEvents', 'MutationEvents'];
    var eventInitArr = ['', '', 'Mouse', 'UI', 'Mutation'];

    /**
     * http://hi.baidu.com/flondon/item/a83892e3b454192a5a7cfb35
     * eventType 共5种类型：Events、HTMLEvents、UIEevents、MouseEvents、MutationEvents。
     * ● Events ：所有的事件。
     * ● HTMLEvents：abort、blur、change、error、focus、load、reset、resize、scroll、select、submit、unload。
     * ● UIEvents：DOMActivate、DOMFocusIn、DOMFocusOut、keydown、keypress、keyup。
     * ● MouseEvents：click、mousedown、mousemove、mouseout、mouseover、mouseup、touch。
     * ● MutationEvents：DOMAttrModified、DOMNodeInserted、DOMNodeRemoved、DOMCharacterDataModified、DOMNodeInsertedIntoDocument、DOMNodeRemovedFromDocument、DOMSubtreeModified。
     */
    var htmlEvents = 'abort blur change error focus load reset resize scroll select submit unload'.split(' ');
    var mouseEvents = /click|mouse|touch/;
    var uiEvents = /key|DOM(Active|Focus)/;
    var mutationEvents = /DOM(Attr|Node|Character|Subtree)/;

    // Any events specific to one element do not bubble: submit, focus, blur, load,
    // unload, change, reset, scroll, most of the DOM events (DOMFocusIn, DOMFocusOut, DOMNodeRemoved, etc),
    // mouseenter, mouseleave, etc
    // @link http://stackoverflow.com/questions/5574207/javascript-which-events-do-not-bubble
    var canNotBubbleEvents = 'blur error focus load unload change scroll submit mouseenter mouseleave'.split(' ');


    /**
     * static
     * @type {{create: create, dispatch: dispatch, on: on, un: un}}
     */
    module.exports = {
        /**
         * 事件创建
         * @param {String} eventType 事件类型
         * @param {Object} [properties] 事件属性
         * @param {Boolean} [properties.bubbles] 是否冒泡，默认 true
         * @param {Boolean} [properties.cancelable] 是否可以被取消冒泡，默认 true
         * @param {Object} [properties.detail] 事件细节，默认{}
         * @returns {Event}
         * @link https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events
         *
         * @example
         * event.create('myclick');
         * event.create('myclick', {
         *     bubbles: !0,
         *     cancelable: !0,
         *     detail: {
         *        a: 1,
         *        b: 2
         *     },
         * });
         */
        create: function (eventType, properties) {
            properties = dato.extend({}, defaults, properties);

            var et;
            var args;
            var eventTypeIndex = 0;

            try {
                // ie11+/chrome/firefox
                et = new Event(eventType, properties);
            } catch (err1) {
                try {
                    // who?
                    et = new CustomEvent(eventType, properties);
                } catch (err2) {
                    // <= 10
                    args = [eventType, !!properties.bubbles, !!properties.cancelable, window, {},
                        0, 0, 0, 0, !1, !1, !1, !1, 0, null
                    ];

                    if (htmlEvents.indexOf(eventType)) {
                        eventTypeIndex = 1;
                    } else if (mouseEvents.test(eventType)) {
                        eventTypeIndex = 2;
                    } else if (uiEvents.test(eventType)) {
                        eventTypeIndex = 3;
                    } else if (mutationEvents.test(eventType)) {
                        eventTypeIndex = 4;
                    }

                    et = document.createEvent(eventTypeArr[eventTypeIndex]);
                    et['init' + eventInitArr[eventTypeIndex] + 'Event'].apply(et, args);
                }
            }

            return et;
        },

        /**
         * 触发事件
         * @param {HTMLElement|Node|EventTarget} ele 元素
         * @param {Event|String} eventTypeOrEvent 事件类型或事件名称
         * @param {Event} [copyEvent] 需要复制的事件信息
         * @returns {Object} event
         *
         * @example
         * event.dispatch(ele, 'myclick');
         * event.dispatch(ele, myclikEvent);
         * // 从当前事件 eve 上复制细节信息
         * event.dispatch(ele, myclikEvent, eve);
         */
        dispatch: function (ele, eventTypeOrEvent, copyEvent) {
            var et = typeis(eventTypeOrEvent) === 'string' ?
                this.create(eventTypeOrEvent) :
                eventTypeOrEvent;

            if (copyEvent) {
                et = this.extend(et, copyEvent);
            }

            // 同时触发相同的原生事件会报错
            try {
                ele.dispatchEvent(et);
            } catch (err) {
                // ignore
            }

            return et;
        },

        /**
         * 扩展创建的事件对象，因自身创建的事件对象细节较少，需要从其他事件上 copy 过来
         * @param {String|Event} createEvent 创建事件
         * @param {Event} copyEvent 复制事件
         * @param {Object} [detail] 事件细节，将会在事件上添加 alien 的细节，alienDetail（防止重复）
         * @returns {Event} 创建事件
         *
         * @example
         * event.extend('myclick', clickEvent, {
         *     a: 1,
         *     b: 2
         * });
         */
        extend: function (createEvent, copyEvent, detail) {
            if (typeis(createEvent) === 'string') {
                createEvent = this.create(createEvent);
            }

            dato.each(mustEventProperties, function (index, prototype) {
                if (prototype in copyEvent) {
                    try {
                        // 某些浏览器不允许重写只读属性，如 iPhone safari
                        createEvent[prototype] = copyEvent[prototype];
                    } catch (err) {
                        // ignore
                    }
                }
            });

            detail = detail || {};
            createEvent.alienDetail = createEvent.alienDetail || {};

            dato.each(detail, function (key, val) {
                createEvent.alienDetail[key] = val;
            });

            return createEvent;
        },

        /**
         * 事件监听
         * @param {Object|HTMLElement|Node} element 元素
         * @param {String} eventType 事件类型，多个事件使用空格分开
         * @param {String} [selector] 事件委托时的选择器，默认空
         * @param {Function} listener 事件回调
         * @param {Boolean} [isCapture] 是否事件捕获，默认false
         *
         * @example
         * // un capture
         * event.on(ele, 'click', fn, false):
         * event.on(ele, 'click', 'li', fn, false):
         *
         * // is capture
         * event.on(ele, 'click', fn, true):
         * event.on(ele, 'click', 'li', fn, true):
         */
        on: function (element, eventType, selector, listener, isCapture) {
            if (!element || !element.addEventListener) {
                return;
            }

            var callback;
            var eventTypes = String(eventType).trim().split(regSpace);
            isCapture = arguments[arguments.length - 1];

            if (typeis(isCapture) !== 'boolean') {
                isCapture = !1;
            }

            // on self
            // .on(body, 'click', fn);
            if (typeis(arguments[2]) === 'function') {
                callback = arguments[2];
                listener = arguments[2];
            }
            // delegate
            // .on(body, 'click', 'p', fn)
            else if (typeis(listener) === 'function') {
                callback = function (eve) {
                    // 符合当前事件 && 最近的DOM符合选择器 && 触发dom在当前监听dom里
                    var closestElement = domSelector.closest(eve.target, selector);

                    if (eventTypes.indexOf(eve.type) > -1 && closestElement.length && element.contains(closestElement[0])) {
                        return listener.call(closestElement[0], eve);
                    }
                };
            }

            if (callback) {
                dato.each(eventTypes, function (index, eventType) {
                    if (typeis(listener) === 'function' && eventType) {
                        _on(element, eventType, callback, listener, isCapture);
                    }
                });
            }
        },

        /**
         * 移除事件监听
         * @param {window|HTMLElement|Node} element 元素
         * @param {String} eventType 事件类型
         * @param {Function} [listener=null] 回调，回调为空表示删除所有已经在 alien 中注册的事件
         * @param {Boolean} [isCapture=false] 是否事件捕获，默认false
         *
         * @example
         * // remove one listener
         * event.un(ele, 'click', fn, false);
         * event.un(ele, 'click', fn, true);
         *
         * // remove all listener
         * event.un(ele, 'click', false);
         * event.un(ele, 'click');
         */
        un: function (element, eventType, listener, isCapture) {
            if (!element || !element.addEventListener) {
                return;
            }

            var args = Array.prototype.slice.call(arguments);
            var eventTypes = String(eventType).trim().split(regSpace);

            dato.each(eventTypes, function (index, eventType) {
                if (eventType) {
                    args.splice(1, 1, eventType);
                    _un.apply(window, args);
                }
            });
        },

        /**
         * 获得某元素的事件队列长度
         * @param {window|HTMLElement|Node} ele 元素
         * @param {String} eventType 单个事件类型
         * @param {Boolean} [isCapture=false] 是否为捕获事件，默认为 false
         * @returns {Number} 事件队列长度，最小值为0
         *
         * @example
         * event.length(ele, 'click');
         * // => 0 or more
         *
         * event.length(ele, 'click', true);
         * // => 0 or more
         */
        length: function (ele, eventType, isCapture) {
            var id = ele[key];
            eventType = String(eventType).trim();

            if (!eventType) {
                return 0;
            }

            return isCapture ?
                (isCaptureOriginalListeners && isCaptureOriginalListeners[id] &&
                isCaptureOriginalListeners[id][eventType] || []).length :
                (unCaptureOriginalListeners && unCaptureOriginalListeners[id] &&
                unCaptureOriginalListeners[id][eventType] || []).length;
        }
    };


    /**
     * 添加事件监听队列
     * @param {HTMLElement|Object} element 元素
     * @param {String} eventType 单个事件类型
     * @param {Function} actualListener 实际事件
     * @param {Function} originalListener 原始事件
     * @param {Boolean} isCapture 是否事件捕获
     * @private
     */
    function _on(element, eventType, actualListener, originalListener, isCapture) {
        // 写入 DOMId，以便后续认识它
        if (!element[key]) {
            element[key] = ++domId;
        }

        var id = element[key];

        unCaptureOriginalListeners[id] = unCaptureOriginalListeners[id] || {};
        isCaptureOriginalListeners[id] = isCaptureOriginalListeners[id] || {};
        unCaptureActualListeners[id] = unCaptureActualListeners[id] || {};
        isCaptureActualListeners[id] = isCaptureActualListeners[id] || {};
        unCaptureRealListeners[id] = unCaptureRealListeners[id] || {};
        isCaptureRealListeners[id] = isCaptureRealListeners[id] || {};
        unCaptureOriginalListeners[id][eventType] = unCaptureOriginalListeners[id][eventType] || [];
        isCaptureOriginalListeners[id][eventType] = isCaptureOriginalListeners[id][eventType] || [];
        unCaptureActualListeners[id][eventType] = unCaptureActualListeners[id][eventType] || [];
        isCaptureActualListeners[id][eventType] = isCaptureActualListeners[id][eventType] || [];

        if (isCapture) {
            isCaptureOriginalListeners[id][eventType].push(originalListener);
            isCaptureActualListeners[id][eventType].push(actualListener);

            if (!isCaptureRealListeners[id][eventType]) {
                isCaptureRealListeners[id][eventType] = !0;

                element.addEventListener(eventType, function (eve) {
                    var the = this;
                    var domId = the[key];
                    var eventType = eve.type;

                    dato.each(isCaptureActualListeners[domId][eventType], function (index, listener) {
                        if (listener.call(the, eve) === false) {
                            try {
                                eve.preventDefault();
                                eve.stopPropagation();
                                eve.stopImmediatePropagation();
                            } catch (err) {
                                // ignore
                            }
                        }
                    });
                }, !0);
            }
        } else {
            unCaptureOriginalListeners[id][eventType].push(originalListener);
            unCaptureActualListeners[id][eventType].push(actualListener);

            if (!unCaptureRealListeners[id][eventType]) {
                unCaptureRealListeners[id][eventType] = !0;

                element.addEventListener(eventType, function (eve) {
                    var the = this;
                    var domId = the[key];
                    var eventType = eve.type;

                    dato.each(unCaptureActualListeners[domId][eventType], function (index, listener) {
                        if (listener.call(the, eve) === false) {
                            try {
                                eve.preventDefault();
                                eve.stopPropagation();
                                eve.stopImmediatePropagation();
                            } catch (err) {
                                // ignore
                            }
                        }
                    });
                }, !1);
            }
        }
    }


    /**
     * 移除事件队列
     * @param {HTMLElement|Object} element 元素
     * @param {String} eventType 单个事件类型
     * @param {Function} [originalListener] 原始事件，事件为空为删除所有已被 alien 注册事件
     * @param {Boolean} isCapture 是否事件捕获
     * @private
     */
    function _un(element, eventType, originalEvent, isCapture) {
        var domId = element[key];
        var findIndex;
        var args = arguments;
        var argL = args.length;

        if (argL === 3) {
            // _un(ele, 'click', true);
            if (typeis(args[2]) === 'boolean') {
                isCapture = args[2];
                originalEvent = null;
            }
            // _un(ele, 'click', fn);
            else {
                isCapture = !1;
            }
        }

        if (domId) {
            if (isCapture) {
                if (typeis(originalEvent) === 'function') {
                    findIndex = isCaptureOriginalListeners[domId][eventType].indexOf(originalEvent);

                    if (findIndex > -1) {
                        isCaptureOriginalListeners[domId][eventType].splice(findIndex, 1);
                        isCaptureActualListeners[domId][eventType].splice(findIndex, 1);
                    }
                } else {
                    isCaptureOriginalListeners[domId][eventType] = [];
                    isCaptureActualListeners[domId][eventType] = [];
                }
            } else {
                if (typeis(originalEvent) === 'function') {
                    findIndex = unCaptureOriginalListeners[domId][eventType].indexOf(originalEvent);

                    if (findIndex > -1) {
                        unCaptureOriginalListeners[domId][eventType].splice(findIndex, 1);
                        unCaptureActualListeners[domId][eventType].splice(findIndex, 1);
                    }
                } else {
                    unCaptureOriginalListeners[domId][eventType] = [];
                    unCaptureActualListeners[domId][eventType] = [];
                }
            }
        } else {
            element.removeEventListener(eventType, originalEvent, isCapture);
        }
    }
});
