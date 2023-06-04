/**
 * 
 * 使用方法：打开掌上飞车APP, 点击下方发现, 点击每日签到, 点击签到即可。
 * 
 * hostname: mwegame.qq.com
 * 
 * type: http-request
 * regex: ^https://mwegame\.qq\.com/ams/sign/doSign/month
 * script-path: https://raw.githubusercontent.com/chiupam/surge/main/scripts/javascripts/zsfc.js
 * requests-body: 1
 * 
 * type: cron
 * cron: 0 10 0 * * *
 * script-path: https://raw.githubusercontent.com/chiupam/surge/main/scripts/javascripts/zsfc.js
 * 
 * =============== Surge ===============
 * 掌上飞车Cookie = type=http-request, pattern=^https://mwegame\.qq\.com/ams/sign/doSign/month, requires-body=1, max-size=-1, script-path=https://raw.githubusercontent.com/chiupam/surge/main/scripts/javascripts/zsfc.js, script-update-interval=0, timeout=5
 * 掌上飞车 =type=cron, cronexp="0 10 0 * * *", wake-system=1, script-path=https://raw.githubusercontent.com/chiupam/surge/main/scripts/javascripts/zsfc.js, script-update-interval=0, timeout=5
 * 
 * =============== Loon ===============
 * http-request ^https://mwegame\.qq\.com/ams/sign/doSign/month script-path=https://raw.githubusercontent.com/chiupam/surge/main/scripts/javascripts/zsfc.js, requires-body=true, timeout=10, tag=掌上飞车Cookie
 * cron "0 10 0 * * *" script-path=https://raw.githubusercontent.com/chiupam/surge/main/scripts/javascripts/zsfc.js, tag=掌上飞车Cookie
 * 
 * =============== Quan X ===============
 * ^https://mwegame\.qq\.com/ams/sign/doSign/month url scripts-request-body https://raw.githubusercontent.com/chiupam/surge/main/scripts/javascripts/zsfc.js
 * 0 10 0 * * * https://raw.githubusercontent.com/chiupam/surge/main/scripts/javascripts/zsfc.js, tag=掌上飞车Cookie, enabled=true
 * 
*/

const $ = new Env(`🏎️ 掌上飞车`)
const date = new Date()
const illustrate = `掌上飞车APP => 发现 => 每日签到 => 点击签到`

/**
 * 检查是否为请求阶段
 */
const isReq = typeof $request !== 'undefined';

/**
 * 主函数，用于执行打卡操作或设置请求数据
 */
(async () => {
  if (isReq) {
    // 请求阶段，设置请求数据
    if (!$request.url || !$request.headers) {
      // 无法读取请求头，显示配置错误通知
      $.notice($.name, '', '⭕ 无法读取请求头, 请检查配置');
      return;
    }

    // 提取请求数据
    const url = $request.url.replace(/&gift_id=\d+/, '');
    const headers = $.toStr($request.headers);
    const query = [
      `userId=${matchParam(url, 'userId')}`,
      `areaId=${matchParam(url, 'areaId')}`,
      `roleId=${matchParam(url, 'roleId')}`,
      `token=${matchParam(url, 'token')}`,
      `uin=${matchParam(url, 'uin')}`,
    ].join('&');

    // 将请求数据写入内存
    $.write(url, 'zsfc_url');
    $.write(headers, 'zsfc_headers');
    $.write(query, 'zsfc_query');

    $.notice($.name, '✅ 获取签到数据成功！', '请不要再次打开掌上飞车APP, 否则 Cookie 将失效！');
  } else {
    // 执行打卡操作阶段
    const url = $.read('zsfc_url');
    const query = $.read('zsfc_query');

    if (!url) {
      // Cookie 为空，显示获取Cookie错误通知
      $.notice($.name, '❌ 当前 Cookie 为空, 请先获取', illustrate);
      return;
    }

    if (query.indexOf('&areaId=&') !== -1) {
      // Cookie 错误，显示重新获取Cookie错误通知
      $.notice($.name, '❌ 当前 Cookie 错误, 请重新获取', illustrate);
      return;
    }

    // 获取连续签到的礼物ID
    const successiveGiftId = await getSuccessiveGiftId();
    // 进行连续签到
    const isSuccessiveCheckin = await dailyCheckin(successiveGiftId);

    if (!isSuccessiveCheckin) {
      // Cookie 失效，显示重新获取Cookie错误通知
      $.notice($.name, '❌ 当前 Cookie 已失效, 请重新获取', illustrate);
      return;
    }

    // 获取签到信息数组
    signInInfoArray = await getSignInInfo();

    // 遍历签到信息数组，领取每日礼物
    for (let signInInfo of signInInfoArray) {
      let { code, title } = signInInfo;
      await claimGift(code, title);
    }

    // 显示签到结果通知
    $.notice($.name, $.subtitle, $.message, ``)

  }
})()
  .catch((e) => $.notice($.name, '❌ 未知错误无法打卡', e, ''))
  .finally(() => $.done());


/**
 * 匹配 URL 参数
 * @param {string} url - URL 字符串
 * @param {string} key - 参数名
 * @returns {string}
 */
function matchParam(url, key) {
  const match = url.match(new RegExp(`${key}=([^&]+)`));
  return match ? match[1] : '';
}

/**
 * 获取连续签到的礼物 ID
 * @returns {Promise<string>} 返回连续签到的礼物 ID
 */
async function getSuccessiveGiftId() {
  let giftid; // 用于保存连续签到的礼物 ID

  // 构造请求参数
  const options = {
    url: `https://mwegame.qq.com/ams/sign/month/speed?${$.read(`zsfc_query`)}`,
    headers: $.toObj($.read(`zsfc_headers`))
  };

  // 发送 GET 请求，获取签到页面信息
  return new Promise(resolve => {
    $.get(options, (err, resp, data) => {
      if (data) {
        // 解析响应数据，提取礼物 ID
        giftid = data.match(/giftid="([^"]+)"/g)[0].match(/(\d+)/)[1];
      }
      resolve(giftid);
    });
  });
}

/**
 * 每日签到函数
 * @param {string} giftId 礼物 ID
 * @returns {Promise<boolean>} 返回签到结果，true 表示签到成功，false 表示签到失败
 */
async function dailyCheckin(giftId) {
  let result = false; // 初始化签到结果为 false

  // 构造请求参数
  const options = {
    url: `${$.read("zsfc_url")}&gift_id=${giftId}`,
    headers: $.toObj($.read(`zsfc_headers`))
  };

  // 输出日志，开始每日签到
  $.log(`🧑‍💻 开始每日签到`);

  // 发送 GET 请求，进行签到
  return new Promise(resolve => {
    $.get(options, (err, resp, data) => {
      if (data) {
        // 解析响应数据
        let body = $.toObj(data.replace(/\r|\n/ig, ``));
        let message = body.message;

        if (message.indexOf(`重试`) > -1) {
          // Cookie 失效，签到失败
          $.log(`❌ 当前 Cookie 已失效, 请重新获取`);
          $.message = ``;
        } else if (message.indexOf(`已经`) > -1) {
          // Cookie 有效，再次签到
          result = true;
          $.log(`⭕ 签到结果: ${message}`);
          $.message = `签到结果: ${message}`;
        } else {
          // Cookie 有效，签到成功
          result = true;
          $.log(`✅ ${body.send_result.sMsg}`);
          $.message = body.send_result.sMsg.replace("：", ":");
        }
      } else {
        // 发生错误，签到失败
        $.log(`❌ 进行每日签到时发生错误`);
        $.log($.toStr(err));
      }
      resolve(result);
    });
  });
}

/**
 * @description 获取签到信息，并返回签到礼物列表
 * @returns {Promise<Array>} 一个返回包含签到礼物的数组的 Promise。
 */
async function getSignInInfo() {
  const options = {
    url: `https://mwegame.qq.com/ams/sign/month/speed?${$.read(`zsfc_query`)}`,
    headers: $.toObj($.read(`zsfc_headers`))
  }

  // 输出日志，开始获取累计签到天数
  $.log(`🧑‍💻 开始获取累计签到天数`)

  let signInGifts = []; // 初始化 signInGifts 为空列表

  // 发送 GET 请求，获取签到信息
  return new Promise(resolve => {
    $.get(options, (err, resp, data) => {
      if (data) {
        // 定义一个数组，用于将累计签到天数映射到礼物编号
        const giftIndexByDay = [0, 1, 2, 3, 0, 4, 0, 5, 0, 6, 7, 8, 0, 9, 0, 10, 11, 0, 12, 13, 0, 14, 15, 0, 0, 16, 0, 0, 0, 0, 0, 0];

        // 使用正则表达式获取累计签到天数
        const totalSignInDays = Number(data.match(/<span id="my_count">(\d+)<\/span>/)?.[1]);
        $.subtitle = `✅ 累计签到 ${totalSignInDays} 天`;
        $.log($.subtitle);

        // 根据累计签到天数获取礼物编号，并将其添加到 signInGifts 中
        const giftIndex = giftIndexByDay[totalSignInDays];
        const giftCode = giftIndex ? data.match(/giftid="([^"]+)"/g)[giftIndex].match(/(\d+)/)[1] : null;
        if (giftCode && giftIndex) signInGifts.push({ code: giftCode, title:  `第 ${giftIndexByDay.indexOf(giftIndex)} 天奖励` });

        // 获取当前日期的日数，并检查是否为每月的第 X 天，如果是则将礼物编号添加到 signInGifts 中
        const [matchMonthDay] = data.match(/月(\d+)日/g) || [];
        const [, day] = matchMonthDay?.match(/(\d+)/) || [];
        if (day && Number(day) === date.getDate()) {
          const giftDays = data.match(/"giftdays([^"]+)"/g)[0].match(/(\d+)/)[1];
          const dayWelfare = `${date.getMonth() + 1}月${date.getDate()}日`;
          signInGifts.push({ code: giftDays, title: ` ${dayWelfare} 特别福利` });
        }

      } else {
        // 发生错误，输出错误日志
        $.log(`❌ 获取累计签到天数时发生错误`);
        $.log($.toStr(err));
      }
      // 将 signInGifts 作为 Promise 的返回值，以便在调用方使用
      resolve(signInGifts);
    });
  });
}

/**
 * 领取礼物函数
 * @param {string} giftId 礼物 ID
 * @param {string} giftName 礼物名称
 */
async function claimGift(giftId, giftName) {
  const options = {
    url: `https://mwegame.qq.com/ams/send/handle`,
    headers: $.toObj($.read(`zsfc_headers`)),
    body: `${$.read(`zsfc_query`)}&gift_id=${giftId}`
  };

  // 输出日志，开始领取礼物
  $.log(`🧑‍💻 开始领取${giftName}`);

  return new Promise(resolve => {
    $.post(options, (err, resp, data) => {
      if (data) {
        let result = $.toObj(data.replace(/\r|\n/ig, ``));
        if (result.data.indexOf(`成功`) != -1) {
          // 领取成功，获取礼物名称并记录日志
          const sPackageName = result.send_result.sPackageName;
          $.log(`✅ 领取结果: 获得${sPackageName}`);
          $.message += `, ${sPackageName}`;
        } else {
          // 领取失败，记录错误信息日志
          $.log(`⭕ 领取结果: ${result.message}`);
        }
      } else {
        // 发生错误，输出错误日志
        $.log(`❌ 开始领取${giftName}时发生错误`);
        $.log($.toStr(err));
      }
      resolve();
    });
  })
}
 
function Env(name) {
  LN = typeof $loon != `undefined`
  SG = typeof $httpClient != `undefined` && !LN
  QX = typeof $task != `undefined`
  read = (key) => {
    if (LN || SG) return $persistentStore.read(key)
    if (QX) return $prefs.valueForKey(key)
  }
  write = (key, val) => {
    if (LN || SG) return $persistentStore.write(key, val); 
    if (QX) return $prefs.setValueForKey(key, val)
  }
  notice = (title, subtitle, message, url) => {
    if (LN) $notification.post(title, subtitle, message, url)
    if (SG) $notification.post(title, subtitle, message, { url: url })
    if (QX) $notify(title, subtitle, message, { 'open-url': url })
  }
  get = (url, cb) => {
    if (LN || SG) {$httpClient.get(url, cb)}
    if (QX) {url.method = `GET`; $task.fetch(url).then((resp) => cb(null, {}, resp.body))}
  }
  post = (url, cb) => {
    if (LN || SG) {$httpClient.post(url, cb)}
    if (QX) {url.method = `POST`; $task.fetch(url).then((resp) => cb(null, {}, resp.body))}
  }
  toObj = (str) => JSON.parse(str)
  toStr = (obj) => JSON.stringify(obj)
  log = (message) => console.log(message)
  done = (value = {}) => {$done(value)}
  return { name, read, write, notice, get, post, toObj, toStr, log, done }
}
