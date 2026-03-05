/**
 * RF-6 中控软件 — 前端路由与交互、分组、创建场景
 */

(function () {
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('.nav-link');
  const quickCards = document.querySelectorAll('.quick-card[data-target]');

  // ——— 路由 ———
  function showPage(id) {
    const targetId = id && id.startsWith('#') ? id.slice(1) : id;
    pages.forEach(function (page) {
      page.classList.toggle('active', page.id === targetId);
    });
    navLinks.forEach(function (link) {
      const href = link.getAttribute('href') || '';
      const linkId = href.startsWith('#') ? href.slice(1) : href;
      link.classList.toggle('active', linkId === targetId);
    });
    const titles = {
      dashboard: '仪表盘',
      devices: '设备管理',
      scenes: '场景管理',
      dataUpdate: '数据更新',
      convert: '格式转换',
      settings: '系统设置'
    };
    if (titles[targetId]) {
      document.title = titles[targetId] + ' · RF-6 中控软件';
    }
    if (targetId === 'devices') renderDevicesByGroup();
    if (targetId === 'scenes') renderSceneTable();
    if (targetId === 'data-update') renderDataUpdatePage();
    if (targetId === 'dashboard') renderDashboard();
  }

  function getPageFromHash() {
    return window.location.hash.slice(1) || 'dashboard';
  }

  function initRoute() {
    showPage(getPageFromHash());
  }

  window.addEventListener('hashchange', initRoute);
  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) window.location.hash = href;
    });
  });
  quickCards.forEach(function (card) {
    card.addEventListener('click', function () {
      const target = card.getAttribute('data-target');
      if (target) window.location.hash = '#' + target;
    });
  });

  // ——— 仪表盘渲染（分组运行场景、设备方框） ———
  function renderDashboard() {
    var onlineCount = deviceStore.devices.filter(function (d) { return d.status === '在线' || d.status === '运行中'; }).length;
    var countEl = document.getElementById('dashboard-online-count');
    if (countEl) countEl.textContent = onlineCount;

    function groupSceneLabel(devices) {
      var running = devices.filter(function (d) { return d.status === '运行中' && d.scene && d.scene !== '无'; });
      if (running.length === 0) return '—';
      var scenes = running.map(function (d) { return d.scene; });
      var uniq = scenes.filter(function (s, i, a) { return a.indexOf(s) === i; });
      return uniq.length === 1 ? uniq[0] : '组内场景不同';
    }

    var gridEl = document.getElementById('dashboard-device-grid');
    if (gridEl) {
      var groups = deviceStore.groups.slice();
      var html = '';
      function renderGroupBoxes(devices) {
        return devices.map(function (d) {
          var cls = 'device-box ';
          var isRunning = d.status === '运行中' && d.scene && d.scene !== '无';
          if (d.abnormal) cls += 'abnormal';
          else if (d.runState === 'updating') cls += 'updating';
          else if (isRunning) cls += 'running';
          else cls += 'idle';
          var sceneHtml = isRunning ? '<span class="device-box-scene">' + d.scene + '</span>' : '';
          return '<div class="' + cls + '" data-device-id="' + d.id + '" title="' + d.name + '">' +
            '<span class="device-box-id">' + d.id + '</span>' + sceneHtml + '</div>';
        }).join('');
      }
      var ungrouped = deviceStore.devices.filter(function (d) { return !d.groupId; });
      var sceneLabel = groupSceneLabel(ungrouped);
      html += '<div class="device-group-boxes"><h4 class="device-group-boxes-title">未分组 <span class="count">(' + ungrouped.length + ')</span><span class="group-current-scene">' + sceneLabel + '</span></h4><div class="device-grid">' + renderGroupBoxes(ungrouped) + '</div></div>';
      groups.forEach(function (g) {
        var list = deviceStore.devices.filter(function (d) { return d.groupId === g.id; });
        sceneLabel = groupSceneLabel(list);
        html += '<div class="device-group-boxes"><h4 class="device-group-boxes-title">' + g.name + ' <span class="count">(' + list.length + ')</span><span class="group-current-scene">' + sceneLabel + '</span></h4><div class="device-grid">' + renderGroupBoxes(list) + '</div></div>';
      });
      gridEl.innerHTML = html;
    }
  }

  document.getElementById('dashboard').addEventListener('click', function (e) {
    var box = e.target.closest('.device-box');
    if (box) {
      var id = box.getAttribute('data-device-id');
      if (id) openDeviceDetailModal(id);
    }
  });

  function openDeviceDetailModal(deviceId) {
    var dev = deviceStore.devices.find(function (d) { return d.id === deviceId; });
    if (!dev) return;
    document.getElementById('dd-device-id').value = deviceId;
    document.getElementById('dd-id').textContent = dev.id;
    document.getElementById('dd-name').textContent = dev.name;
    document.getElementById('dd-ip').textContent = dev.networkIP || '—';
    document.getElementById('dd-scene').textContent = dev.scene || '—';
    document.getElementById('dd-stored-scenes').textContent = (dev.storedScenes && dev.storedScenes.length) ? dev.storedScenes.join('、') : '—';
    document.getElementById('dd-storage').textContent = dev.storageFree || '—';
    document.getElementById('dd-status').textContent = dev.abnormal ? '异常' : (dev.status || '—');
    var startBtn = document.getElementById('btn-dd-start');
    var stopBtn = document.getElementById('btn-dd-stop');
    startBtn.style.display = dev.status === '运行中' ? 'none' : 'inline-flex';
    stopBtn.style.display = dev.status === '运行中' ? 'inline-flex' : 'none';
    openModal('modal-device-detail');
  }

  document.getElementById('btn-dd-start').addEventListener('click', function () {
    var id = document.getElementById('dd-device-id').value;
    var dev = deviceStore.devices.find(function (d) { return d.id === id; });
    if (!dev) return;
    if (dev.runState === 'updating') {
      alert('设备 ' + dev.name + '（' + dev.id + '）正在数据更新中，无法启动');
      return;
    }
    if (!dev.scene || dev.scene === '无') {
      alert('设备 ' + dev.name + '（' + dev.id + '）未配置场景，无法启动');
      return;
    }
    dev.status = '运行中';
    closeModal('modal-device-detail');
    renderDashboard();
    renderDevicesByGroup();
  });
  document.getElementById('btn-dd-stop').addEventListener('click', function () {
    var id = document.getElementById('dd-device-id').value;
    var dev = deviceStore.devices.find(function (d) { return d.id === id; });
    if (dev) { dev.status = '在线'; closeModal('modal-device-detail'); renderDashboard(); renderDevicesByGroup(); }
  });

  // ——— 设备与分组数据 ———
  var deviceStore = {
    groups: [
      { id: 'g1', name: '一楼机柜' },
      { id: 'g2', name: '二楼机柜' }
    ],
    devices: []
  };

  function buildDevices() {
    const statuses = ['在线', '离线', '运行中'];
    const scenes = ['Scene-1', 'Scene-2', '无'];
    const list = [];
    for (let i = 1; i <= 30; i++) {
      const n = String(i).padStart(2, '0');
      list.push({
        id: 'RF-' + n,
        name: 'RF-6-' + n,
        scene: scenes[i % 3],
        status: statuses[i % 3],
        groupId: i <= 10 ? 'g1' : (i <= 20 ? 'g2' : null),
        runState: 'idle',
        storedScenes: i % 2 === 0 ? ['Scene-1', 'Scene-2'] : ['Scene-1'],
        firmwareVersion: '1.0.' + (i % 5 + 1),
        lastUpdateDate: '2024-06-' + String(10 + (i % 19)).padStart(2, '0'),
        networkIP: '192.168.1.' + (100 + i),
        storageFree: (64 + (i % 5) * 32) + ' GB',
        abnormal: i === 5 || i === 17
      });
    }
    deviceStore.devices = list;
  }
  buildDevices();

  var RUN_STATE_LABEL = { idle: '空闲', running: '运行中', updating: '数据更新中' };
  var RUN_STATE_CLASS = { idle: '', running: 'running', updating: 'updating' };

  var STATUS_CLASS = { '在线': 'online', '离线': 'offline', '运行中': 'running' };

  function renderDevicesByGroup() {
    var container = document.getElementById('device-groups-container');
    if (!container) return;

    var groups = deviceStore.groups.slice();
    var html = '';

    function renderTable(devices) {
      if (devices.length === 0) {
        return '<div class="table-wrap"><p class="empty-tip">暂无设备</p></div>';
      }
      var rows = devices.map(function (d) {
        var isRunning = d.status === '运行中';
        return '<tr data-device-id="' + d.id + '">' +
          '<td><input type="checkbox" class="device-check" data-device-id="' + d.id + '" /></td>' +
          '<td>' + d.id + '</td><td>' + d.name + '</td><td>' + d.scene + '</td>' +
          '<td><button type="button" class="btn btn-sm btn-outline btn-device-scene-setting" data-device-id="' + d.id + '">场景设置</button></td>' +
          '<td><span class="badge ' + (STATUS_CLASS[d.status] || '') + '">' + d.status + '</span></td>' +
          '<td><button type="button" class="btn btn-sm ' + (isRunning ? 'btn-outline btn-device-stop" data-device-id="' + d.id + '">停止' : 'btn-primary btn-device-start" data-device-id="' + d.id + '">启动') + '</button></td></tr>';
      });
      return '<div class="table-wrap">' +
        '<table class="data-table">' +
        '<thead><tr><th class="th-check"><input type="checkbox" class="device-check-all" title="全选本表" /></th><th>设备ID</th><th>设备名称</th><th>当前场景</th><th>场景设置</th><th>状态</th><th>操作</th></tr></thead>' +
        '<tbody>' + rows.join('') + '</tbody></table></div>';
    }

    function groupTitleRow(title, count, groupId) {
      var gid = groupId == null ? '' : groupId;
      return '<div class="group-title-row">' +
        '<h3 class="group-title">' + title + ' <span class="count">(' + count + ' 台)</span></h3>' +
        '<button type="button" class="btn btn-sm btn-outline btn-group-scene" data-group-id="' + gid + '">组内场景管理</button>' +
        '</div>';
    }

    // 未分组
    var ungrouped = deviceStore.devices.filter(function (d) { return !d.groupId; });
    html += '<div class="device-group-section" data-group-id="">';
    html += groupTitleRow('未分组', ungrouped.length, '');
    html += renderTable(ungrouped);
    html += '</div>';

    groups.forEach(function (g) {
      var list = deviceStore.devices.filter(function (d) { return d.groupId === g.id; });
      html += '<div class="device-group-section" data-group-id="' + g.id + '">';
      html += groupTitleRow(g.name, list.length, g.id);
      html += renderTable(list);
      html += '</div>';
    });

    container.innerHTML = html;

    // 全选本表：每个 table 内的 .device-check-all 勾选时勾选该表内所有 .device-check
    container.querySelectorAll('.device-check-all').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var tbody = cb.closest('table').querySelector('tbody');
        if (tbody) tbody.querySelectorAll('.device-check').forEach(function (c) { c.checked = cb.checked; });
      });
    });
  }

  // 首次进入设备页时渲染
  if (getPageFromHash() === 'devices') renderDevicesByGroup();

  // 设备管理：单机启动/停止（数据更新中、当前场景为无时无法启动）
  function setDeviceStatus(deviceId, status) {
    var dev = deviceStore.devices.find(function (d) { return d.id === deviceId; });
    if (!dev) return;
    if (status === '运行中') {
      if (dev.runState === 'updating') {
        alert('设备 ' + dev.name + '（' + dev.id + '）正在数据更新中，无法启动');
        return;
      }
      if (!dev.scene || dev.scene === '无') {
        alert('设备 ' + dev.name + '（' + dev.id + '）未配置场景，无法启动');
        return;
      }
    }
    dev.status = status;
    renderDevicesByGroup();
  }

  // 设备管理：事件委托（组内场景管理、场景设置、启动、停止）
  document.getElementById('devices').addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-group-scene');
    if (btn) {
      e.preventDefault();
      openGroupSceneModal(btn.getAttribute('data-group-id') || '');
      return;
    }
    btn = e.target.closest('.btn-device-scene-setting');
    if (btn) {
      e.preventDefault();
      var dev = deviceStore.devices.find(function (d) { return d.id === btn.getAttribute('data-device-id'); });
      if (dev && dev.runState === 'updating') {
        alert('设备正在数据更新中，无法修改场景');
        return;
      }
      if (dev && dev.status === '运行中') {
        alert('请停止运行中的设备');
        return;
      }
      openDeviceSceneModal(btn.getAttribute('data-device-id'));
      return;
    }
    btn = e.target.closest('.btn-device-start');
    if (btn) {
      e.preventDefault();
      setDeviceStatus(btn.getAttribute('data-device-id'), '运行中');
      return;
    }
    btn = e.target.closest('.btn-device-stop');
    if (btn) {
      e.preventDefault();
      setDeviceStatus(btn.getAttribute('data-device-id'), '在线');
      return;
    }
  });

  // ——— 组内场景管理弹窗 ———
  function openGroupSceneModal(groupId) {
    document.getElementById('group-scene-group-id').value = groupId;
    var select = document.getElementById('group-scene-select');
    select.innerHTML = sceneList.map(function (s, i) {
      return '<option value="' + i + '">' + s.name + (s.remark ? ' - ' + s.remark : '') + '</option>';
    }).join('');
    var section = document.querySelector('#device-groups-container .device-group-section[data-group-id="' + (groupId || '') + '"]');
    var groupName = groupId ? (deviceStore.groups.find(function (g) { return g.id === groupId; }) || {}).name : '未分组';
    if (!groupId && section) groupName = '未分组';
    document.getElementById('modal-group-scene-desc').textContent = '选择要应用到「' + groupName + '」内所有设备的场景。设备内无该场景时当前场景将显示为「无」。';
    openModal('modal-group-scene');
  }

  document.getElementById('btn-apply-group-scene').addEventListener('click', function () {
    var groupId = document.getElementById('group-scene-group-id').value;
    var sceneIdx = parseInt(document.getElementById('group-scene-select').value, 10);
    var sceneName = sceneList[sceneIdx] ? sceneList[sceneIdx].name : '';
    if (!sceneName) { closeModal('modal-group-scene'); return; }
    var devicesInGroup = deviceStore.devices.filter(function (d) {
      return (groupId === '' && !d.groupId) || d.groupId === groupId;
    });
    var updating = devicesInGroup.filter(function (d) { return d.runState === 'updating'; });
    if (updating.length > 0) {
      alert('组内存在正在数据更新中的设备，无法应用场景');
      return;
    }
    var running = devicesInGroup.filter(function (d) { return d.status === '运行中'; });
    if (running.length > 0) {
      alert('请停止运行中的设备');
      return;
    }
    devicesInGroup.forEach(function (d) {
      d.scene = (d.storedScenes && d.storedScenes.indexOf(sceneName) !== -1) ? sceneName : '无';
    });
    closeModal('modal-group-scene');
    renderDevicesByGroup();
  });

  // ——— 场景设置（单设备）弹窗 ———
  function openDeviceSceneModal(deviceId) {
    var dev = deviceStore.devices.find(function (d) { return d.id === deviceId; });
    if (!dev) return;
    document.getElementById('device-scene-device-id').value = deviceId;
    document.getElementById('modal-device-scene-name').textContent = dev.name + '（' + dev.id + '）';
    var listEl = document.getElementById('device-scene-list');
    var scenes = (dev.storedScenes && dev.storedScenes.length) ? dev.storedScenes : ['无'];
    listEl.innerHTML = scenes.map(function (s) {
      var checked = dev.scene === s ? ' checked' : '';
      return '<label class="device-scene-option"><input type="radio" name="device-scene-radio" value="' + s.replace(/"/g, '&quot;') + '" ' + checked + ' /> ' + s + '</label>';
    }).join('');
    openModal('modal-device-scene');
  }

  document.getElementById('btn-apply-device-scene').addEventListener('click', function () {
    var deviceId = document.getElementById('device-scene-device-id').value;
    var radio = document.querySelector('#device-scene-list input[name="device-scene-radio"]:checked');
    if (!radio) return;
    var dev = deviceStore.devices.find(function (d) { return d.id === deviceId; });
    if (!dev) return;
    if (dev.runState === 'updating') {
      alert('设备正在数据更新中，无法修改场景');
      return;
    }
    if (dev.status === '运行中') {
      alert('请停止运行中的设备');
      return;
    }
    dev.scene = radio.value;
    closeModal('modal-device-scene');
    renderDevicesByGroup();
  });

  // ——— 批量启动 / 批量停止 ———
  function getCheckedDeviceIds() {
    var container = document.getElementById('device-groups-container');
    if (!container) return [];
    var checked = container.querySelectorAll('.device-check:checked');
    return Array.prototype.map.call(checked, function (c) { return c.getAttribute('data-device-id'); });
  }

  document.getElementById('btn-batch-start').addEventListener('click', function () {
    var ids = getCheckedDeviceIds();
    var updating = [];
    var noScene = [];
    ids.forEach(function (id) {
      var dev = deviceStore.devices.find(function (d) { return d.id === id; });
      if (dev && dev.runState === 'updating') updating.push(dev.name + '（' + dev.id + '）');
      if (dev && (!dev.scene || dev.scene === '无')) noScene.push(dev.name + '（' + dev.id + '）');
    });
    if (updating.length > 0) {
      alert('以下设备正在数据更新中，无法批量启动：\n' + updating.join('\n'));
      return;
    }
    if (noScene.length > 0) {
      alert('以下设备未配置场景，无法启动：\n' + noScene.join('\n'));
      return;
    }
    ids.forEach(function (id) {
      var dev = deviceStore.devices.find(function (d) { return d.id === id; });
      if (dev) dev.status = '运行中';
    });
    renderDevicesByGroup();
  });

  document.getElementById('btn-batch-stop').addEventListener('click', function () {
    var ids = getCheckedDeviceIds();
    ids.forEach(function (id) {
      var dev = deviceStore.devices.find(function (d) { return d.id === id; });
      if (dev) dev.status = '在线';
    });
    renderDevicesByGroup();
  });

  // ——— 固件升级 ———
  function renderFirmwareTable() {
    var container = document.getElementById('firmware-groups-container');
    if (!container) return;
    var groups = deviceStore.groups.slice();
    var html = '';
    function renderFwTable(devices) {
      if (devices.length === 0) {
        return '<div class="table-wrap"><p class="empty-tip">暂无设备</p></div>';
      }
      var rows = devices.map(function (d) {
        return '<tr><td>' + d.id + '</td><td>' + (d.firmwareVersion || '—') + '</td><td>' + (d.lastUpdateDate || '—') + '</td></tr>';
      });
      return '<div class="table-wrap">' +
        '<table class="data-table">' +
        '<thead><tr><th>设备编号</th><th>固件版本号</th><th>上次更新日期</th></tr></thead>' +
        '<tbody>' + rows.join('') + '</tbody></table></div>';
    }
    var ungrouped = deviceStore.devices.filter(function (d) { return !d.groupId; });
    html += '<div class="device-group-section"><h3 class="group-title">未分组 <span class="count">(' + ungrouped.length + ' 台)</span></h3>' + renderFwTable(ungrouped) + '</div>';
    groups.forEach(function (g) {
      var list = deviceStore.devices.filter(function (d) { return d.groupId === g.id; });
      html += '<div class="device-group-section"><h3 class="group-title">' + g.name + ' <span class="count">(' + list.length + ' 台)</span></h3>' + renderFwTable(list) + '</div>';
    });
    container.innerHTML = html;
  }

  function renderFirmwareDeviceSelectList() {
    var container = document.getElementById('firmware-select-device-list');
    if (!container) return;
    var groups = deviceStore.groups.slice();
    var html = '<div class="update-select-all"><label><input type="checkbox" class="firmware-check-all" /> 一键全选</label></div>';
    var ungrouped = deviceStore.devices.filter(function (d) { return !d.groupId; });
    html += '<div class="update-group-block"><div class="update-group-header"><label><input type="checkbox" class="firmware-group-check" data-group-id="" /> 未分组</label></div><div class="update-group-devices">';
    ungrouped.forEach(function (d) {
      html += '<label class="update-device-item"><input type="checkbox" class="firmware-device-check" data-device-id="' + d.id + '" /> ' + d.id + ' ' + d.name + '</label>';
    });
    html += '</div></div>';
    groups.forEach(function (g) {
      var list = deviceStore.devices.filter(function (d) { return d.groupId === g.id; });
      html += '<div class="update-group-block"><div class="update-group-header"><label><input type="checkbox" class="firmware-group-check" data-group-id="' + g.id + '" /> ' + g.name + '</label></div><div class="update-group-devices">';
      list.forEach(function (d) {
        html += '<label class="update-device-item"><input type="checkbox" class="firmware-device-check" data-device-id="' + d.id + '" /> ' + d.id + ' ' + d.name + '</label>';
      });
      html += '</div></div>';
    });
    container.innerHTML = html;
    container.querySelector('.firmware-check-all').addEventListener('change', function () {
      container.querySelectorAll('.firmware-device-check').forEach(function (cb) { cb.checked = this.checked; }.bind(this));
      container.querySelectorAll('.firmware-group-check').forEach(function (cb) { cb.checked = this.checked; });
    });
    container.querySelectorAll('.firmware-group-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var block = this.closest('.update-group-block');
        if (!block) return;
        block.querySelectorAll('.firmware-device-check').forEach(function (dc) { dc.checked = cb.checked; });
      });
    });
  }

  document.getElementById('btn-open-firmware').addEventListener('click', function () {
    renderFirmwareTable();
    openModal('modal-firmware-main');
  });
  document.getElementById('btn-open-firmware').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      renderFirmwareTable();
      openModal('modal-firmware-main');
    }
  });

  document.getElementById('btn-firmware-open-select').addEventListener('click', function () {
    closeModal('modal-firmware-main');
    document.getElementById('firmware-path-input').value = '';
    renderFirmwareDeviceSelectList();
    openModal('modal-firmware-select');
  });

  document.getElementById('btn-firmware-browse').addEventListener('click', function () {
    document.getElementById('firmware-file-input').click();
  });
  document.getElementById('firmware-file-input').addEventListener('change', function () {
    var f = this.files && this.files[0];
    document.getElementById('firmware-path-input').value = f ? f.name : '';
  });

  document.getElementById('btn-firmware-start-update').addEventListener('click', function () {
    var container = document.getElementById('firmware-select-device-list');
    if (!container) return;
    var checked = container.querySelectorAll('.firmware-device-check:checked');
    if (checked.length === 0) {
      alert('请至少选择一台设备');
      return;
    }
    var pathInput = document.getElementById('firmware-path-input').value.trim();
    if (!pathInput) {
      alert('请选择固件文件路径');
      return;
    }
    var deviceIds = Array.prototype.map.call(checked, function (c) { return c.getAttribute('data-device-id'); });
    closeModal('modal-firmware-select');
    openModal('modal-firmware-progress');
    var today = new Date();
    var dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var newVer = '1.0.' + (today.getMinutes() % 10 + 1);
    setTimeout(function () {
      deviceIds.forEach(function (id) {
        var dev = deviceStore.devices.find(function (d) { return d.id === id; });
        if (dev) {
          dev.firmwareVersion = newVer;
          dev.lastUpdateDate = dateStr;
        }
      });
      closeModal('modal-firmware-progress');
      renderFirmwareTable();
      openModal('modal-firmware-main');
    }, 2500);
  });

  // ——— 数据更新页面 ———
  function renderDataUpdatePage() {
    var container = document.getElementById('data-update-groups-container');
    if (!container) return;
    var groups = deviceStore.groups.slice();
    var html = '';
    function renderUpdateTable(devices) {
      if (devices.length === 0) {
        return '<div class="table-wrap"><p class="empty-tip">暂无设备</p></div>';
      }
      var rows = devices.map(function (d) {
        var runState = d.runState || 'idle';
        var stateLabel = RUN_STATE_LABEL[runState] || runState;
        var stateClass = RUN_STATE_CLASS[runState] || '';
        var stored = (d.storedScenes && d.storedScenes.length) ? d.storedScenes.join('、') : '—';
        return '<tr><td>' + d.id + '</td><td>' + d.name + '</td><td>' + stored + '</td>' +
          '<td><span class="badge ' + stateClass + '">' + stateLabel + '</span></td></tr>';
      });
      return '<div class="table-wrap">' +
        '<table class="data-table">' +
        '<thead><tr><th>设备编号</th><th>设备名称</th><th>设备内存储的场景</th><th>运行状态</th></tr></thead>' +
        '<tbody>' + rows.join('') + '</tbody></table></div>';
    }
    var ungrouped = deviceStore.devices.filter(function (d) { return !d.groupId; });
    html += '<div class="device-group-section"><h3 class="group-title">未分组 <span class="count">(' + ungrouped.length + ' 台)</span></h3>' + renderUpdateTable(ungrouped) + '</div>';
    groups.forEach(function (g) {
      var list = deviceStore.devices.filter(function (d) { return d.groupId === g.id; });
      html += '<div class="device-group-section" data-group-id="' + g.id + '"><h3 class="group-title">' + g.name + ' <span class="count">(' + list.length + ' 台)</span></h3>' + renderUpdateTable(list) + '</div>';
    });
    container.innerHTML = html;
  }

  if (getPageFromHash() === 'data-update') renderDataUpdatePage();

  // ——— 数据更新弹窗 ———
  var UPDATE_MIN_PER_DEVICE = 2;

  function fillDataUpdateSceneSelect() {
    var sel = document.getElementById('data-update-scene-select');
    if (!sel) return;
    sel.innerHTML = sceneList.map(function (s, i) {
      return '<option value="' + i + '">' + s.name + (s.remark ? ' - ' + s.remark : '') + '</option>';
    }).join('');
  }

  function renderDataUpdateDeviceList() {
    var container = document.getElementById('data-update-device-list');
    if (!container) return;
    var groups = deviceStore.groups.slice();
    var html = '<div class="update-select-all"><label><input type="checkbox" id="data-update-check-all" /> 一键全选</label></div>';
    var ungrouped = deviceStore.devices.filter(function (d) { return !d.groupId; });
    html += '<div class="update-group-block"><div class="update-group-header"><label><input type="checkbox" class="data-update-group-check" data-group-id="" /> 未分组</label></div><div class="update-group-devices">';
    ungrouped.forEach(function (d) {
      html += '<label class="update-device-item"><input type="checkbox" class="data-update-device-check" data-device-id="' + d.id + '" /> ' + d.id + ' ' + d.name + '</label>';
    });
    html += '</div></div>';
    groups.forEach(function (g) {
      var list = deviceStore.devices.filter(function (d) { return d.groupId === g.id; });
      html += '<div class="update-group-block"><div class="update-group-header"><label><input type="checkbox" class="data-update-group-check" data-group-id="' + g.id + '" /> ' + g.name + '</label></div><div class="update-group-devices">';
      list.forEach(function (d) {
        html += '<label class="update-device-item"><input type="checkbox" class="data-update-device-check" data-device-id="' + d.id + '" /> ' + d.id + ' ' + d.name + '</label>';
      });
      html += '</div></div>';
    });
    container.innerHTML = html;
    container.querySelector('#data-update-check-all').addEventListener('change', function () {
      container.querySelectorAll('.data-update-device-check').forEach(function (cb) { cb.checked = this.checked; }.bind(this));
      container.querySelectorAll('.data-update-group-check').forEach(function (cb) { cb.checked = this.checked; });
      refreshUpdateEstimate();
    });
    container.querySelectorAll('.data-update-group-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var gid = this.getAttribute('data-group-id');
        var block = this.closest('.update-group-block');
        if (!block) return;
        block.querySelectorAll('.data-update-device-check').forEach(function (dc) { dc.checked = cb.checked; });
        refreshUpdateEstimate();
      });
    });
    container.querySelectorAll('.data-update-device-check').forEach(function (cb) {
      cb.addEventListener('change', refreshUpdateEstimate);
    });
  }

  function refreshUpdateEstimate() {
    var list = document.getElementById('data-update-device-list');
    if (!list) return;
    var checked = list.querySelectorAll('.data-update-device-check:checked');
    var count = checked.length;
    var totalMin = count * UPDATE_MIN_PER_DEVICE;
    var durationEl = document.getElementById('data-update-duration');
    var completionEl = document.getElementById('data-update-completion');
    if (durationEl) durationEl.textContent = count ? '约 ' + totalMin + ' 分钟' : '—';
    if (completionEl) {
      if (!count) {
        completionEl.textContent = '—';
        return;
      }
      var end = new Date(Date.now() + totalMin * 60 * 1000);
      completionEl.textContent = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0') + ' ' + String(end.getHours()).padStart(2, '0') + ':' + String(end.getMinutes()).padStart(2, '0');
    }
  }

  document.getElementById('btn-open-update-modal').addEventListener('click', function () {
    fillDataUpdateSceneSelect();
    document.getElementById('data-update-step1').style.display = 'block';
    document.getElementById('data-update-step2').style.display = 'none';
    document.getElementById('modal-data-update-title').textContent = '选择要下发的场景';
    openModal('modal-data-update');
  });

  document.getElementById('btn-update-next').addEventListener('click', function () {
    document.getElementById('data-update-step1').style.display = 'none';
    document.getElementById('data-update-step2').style.display = 'block';
    document.getElementById('modal-data-update-title').textContent = '选择要更新的设备';
    renderDataUpdateDeviceList();
    refreshUpdateEstimate();
  });

  document.getElementById('btn-update-prev').addEventListener('click', function () {
    document.getElementById('data-update-step2').style.display = 'none';
    document.getElementById('data-update-step1').style.display = 'block';
    document.getElementById('modal-data-update-title').textContent = '选择要下发的场景';
  });

  document.getElementById('btn-update-start').addEventListener('click', function () {
    var list = document.getElementById('data-update-device-list');
    if (!list) return;
    var checked = list.querySelectorAll('.data-update-device-check:checked');
    var running = [];
    checked.forEach(function (cb) {
      var id = cb.getAttribute('data-device-id');
      var dev = deviceStore.devices.find(function (d) { return d.id === id; });
      if (dev && dev.status === '运行中') running.push(dev.name);
    });
    if (running.length > 0) {
      alert('请停止运行中的设备');
      return;
    }
    checked.forEach(function (cb) {
      var id = cb.getAttribute('data-device-id');
      var dev = deviceStore.devices.find(function (d) { return d.id === id; });
      if (dev) dev.runState = 'updating';
    });
    closeModal('modal-data-update');
    window.location.hash = '#data-update';
    renderDataUpdatePage();
  });

  // 关闭数据更新弹窗时无需额外清理

  // ——— 弹窗通用 ———
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) {
      el.setAttribute('aria-hidden', 'false');
      el.classList.add('is-open');
    }
  }
  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) {
      el.setAttribute('aria-hidden', 'true');
      el.classList.remove('is-open');
    }
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(function (m) {
      m.setAttribute('aria-hidden', 'true');
      m.classList.remove('is-open');
    });
  }

  document.querySelectorAll('.modal-cancel').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var overlay = btn.closest('.modal-overlay');
      if (overlay) {
        if (overlay.id === 'modal-create-scene') {
          editingSceneIndex = -1;
          var titleEl = document.getElementById('modal-create-scene-title');
          if (titleEl) titleEl.textContent = '创建新场景';
        }
        closeModal(overlay.id);
      }
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        if (overlay.id === 'modal-create-scene') {
          editingSceneIndex = -1;
          var titleEl = document.getElementById('modal-create-scene-title');
          if (titleEl) titleEl.textContent = '创建新场景';
        }
        closeModal(overlay.id);
      }
    });
  });

  // ——— 新建分组 ———
  document.getElementById('btn-new-group').addEventListener('click', function () {
    var input = document.getElementById('new-group-name');
    if (input) input.value = '';
    openModal('modal-new-group');
  });
  document.getElementById('btn-save-new-group').addEventListener('click', function () {
    var input = document.getElementById('new-group-name');
    var name = input && input.value.trim();
    if (!name) return;
    deviceStore.groups.push({ id: 'g' + Date.now(), name: name });
    closeModal('modal-new-group');
    renderDevicesByGroup();
  });

  // ——— 分组管理 ———
  function renderGroupManageList() {
    var listEl = document.getElementById('group-manage-list');
    if (!listEl) return;
    listEl.innerHTML = deviceStore.groups.map(function (g) {
      var count = deviceStore.devices.filter(function (d) { return d.groupId === g.id; }).length;
      return '<div class="group-item" data-group-id="' + g.id + '">' +
        '<span class="group-item-name">' + g.name + ' <span class="count">(' + count + ' 台)</span></span>' +
        '<div class="group-item-actions">' +
        '<button type="button" class="btn btn-sm btn-outline btn-assign-device">分配设备</button>' +
        '<button type="button" class="btn btn-sm btn-outline btn-edit-group">编辑</button>' +
        '<button type="button" class="btn btn-sm btn-outline btn-delete-group">删除</button>' +
        '</div></div>';
    }).join('');
    listEl.querySelectorAll('.btn-assign-device').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.group-item');
        var gid = item && item.getAttribute('data-group-id');
        var g = deviceStore.groups.find(function (x) { return x.id === gid; });
        if (g) openAssignModal(g);
      });
    });
    listEl.querySelectorAll('.btn-edit-group').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.group-item');
        var gid = item && item.getAttribute('data-group-id');
        var g = deviceStore.groups.find(function (x) { return x.id === gid; });
        if (!g) return;
        var name = window.prompt('分组名称', g.name);
        if (name != null && name.trim()) {
          g.name = name.trim();
          renderGroupManageList();
          renderDevicesByGroup();
        }
      });
    });
    listEl.querySelectorAll('.btn-delete-group').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.group-item');
        var gid = item && item.getAttribute('data-group-id');
        if (!gid || !window.confirm('确定删除该分组？设备将变为未分组。')) return;
        deviceStore.groups = deviceStore.groups.filter(function (x) { return x.id !== gid; });
        deviceStore.devices.forEach(function (d) {
          if (d.groupId === gid) d.groupId = null;
        });
        renderGroupManageList();
        closeModal('modal-group-manage');
        renderDevicesByGroup();
      });
    });
  }

  document.getElementById('btn-group-manage').addEventListener('click', function () {
    renderGroupManageList();
    openModal('modal-group-manage');
  });

  // ——— 分配设备到分组 ———
  function openAssignModal(group) {
    document.getElementById('assign-group-id').value = group.id;
    document.getElementById('assign-group-name').textContent = group.name;
    var listEl = document.getElementById('assign-device-list');
    var inGroup = deviceStore.devices.filter(function (d) { return d.groupId === group.id; }).map(function (d) { return d.id; });
    listEl.innerHTML = deviceStore.devices.map(function (d) {
      var checked = inGroup.indexOf(d.id) !== -1;
      return '<label><input type="checkbox" data-device-id="' + d.id + '" ' + (checked ? 'checked' : '') + ' />' + d.id + ' ' + d.name + '</label>';
    }).join('');
    closeModal('modal-group-manage');
    openModal('modal-assign-group');
  }

  document.getElementById('btn-confirm-assign').addEventListener('click', function () {
    var gid = document.getElementById('assign-group-id').value;
    var listEl = document.getElementById('assign-device-list');
    var checked = listEl.querySelectorAll('input:checked');
    deviceStore.devices.forEach(function (d) { d.groupId = null; });
    checked.forEach(function (cb) {
      var did = cb.getAttribute('data-device-id');
      var dev = deviceStore.devices.find(function (d) { return d.id === did; });
      if (dev) dev.groupId = gid;
    });
    closeModal('modal-assign-group');
    renderDevicesByGroup();
  });

  // ——— 场景列表（用于创建场景后追加） ———
  var sceneList = [
    { name: 'Scene-1', remark: '示例场景', files: [], loop: true },
    { name: 'Scene-2', remark: '场景描述', files: [], loop: false }
  ];
  var editingSceneIndex = -1; // -1 表示新建，>=0 表示编辑第几项

  function renderSceneTable() {
    var tbody = document.getElementById('scene-tbody');
    if (!tbody) return;
    tbody.innerHTML = sceneList.map(function (s, i) {
      var fileDesc = (s.files && s.files.length) ? s.files.length + ' 个文件' : '—';
      var timeRange = (s.files && s.files[0]) ? (s.files[0].start || '') + ' ~ ' + (s.files[0].end || '') : '—';
      return '<tr data-scene-index="' + i + '">' +
        '<td>' + s.name + '</td><td>' + (s.remark || '') + '</td><td>' + fileDesc + '</td><td>顺序</td><td>' + timeRange + '</td><td></td><td>' + (s.loop ? '是' : '否') + '</td>' +
        '<td><button type="button" class="btn btn-sm btn-outline btn-edit-scene" data-scene-index="' + i + '">编辑</button></td></tr>';
    }).join('');
  }

  // 场景表格点击「编辑」委托
  document.getElementById('scenes').addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-edit-scene');
    if (!btn) return;
    var idx = parseInt(btn.getAttribute('data-scene-index'), 10);
    if (isNaN(idx) || idx < 0 || idx >= sceneList.length) return;
    openSceneModalForEdit(idx);
  });

  // ——— 创建场景弹窗 ———
  var sceneFileData = []; // { path, start, end }

  function getSceneFileRowsContainer() {
    return document.getElementById('scene-file-rows');
  }
  function getSceneOrderBtns() {
    return document.getElementById('scene-order-btns');
  }
  function getSceneTimeRows() {
    return document.getElementById('scene-time-rows');
  }

  function appendFileRow(path, idx) {
    path = path || '';
    if (idx >= sceneFileData.length) {
      sceneFileData.push({ path: path, start: '00:00', end: '23:59' });
      idx = sceneFileData.length - 1;
    }
    var container = getSceneFileRowsContainer();
    if (!container) return;
    var row = document.createElement('div');
    row.className = 'file-row';
    row.dataset.index = idx;
    row.innerHTML = '<input type="text" class="input file-path-input" placeholder="选择文件路径" value="' + (path ? String(path).replace(/"/g, '&quot;') : '') + '" readonly />' +
      '<button type="button" class="btn btn-outline btn-sm btn-select-file">选择文件</button>' +
      '<input type="file" class="file-input-hidden" multiple accept="*" />';
    var pathInput = row.querySelector('.file-path-input');
    var fileInput = row.querySelector('.file-input-hidden');
    row.querySelector('.btn-select-file').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var files = fileInput.files;
      if (files.length === 0) return;
      pathInput.value = files[0].name;
      sceneFileData[idx].path = files[0].name;
      for (var i = 1; i < files.length; i++) {
        sceneFileData.push({ path: files[i].name, start: '00:00', end: '23:59' });
        appendFileRow(files[i].name, sceneFileData.length - 1);
      }
      syncSceneTimeRows();
      syncSceneOrderBtns();
    });
    container.appendChild(row);
  }

  function addSceneFileRow(path) {
    var idx = sceneFileData.length;
    sceneFileData.push({ path: path || '', start: '00:00', end: '23:59' });
    appendFileRow(path || '', idx);
    syncSceneTimeRows();
    syncSceneOrderBtns();
  }

  function syncSceneTimeRows() {
    var container = getSceneTimeRows();
    if (!container) return;
    container.innerHTML = sceneFileData.map(function (f, i) {
      return '<div class="time-row" data-index="' + i + '">' +
        '<span class="time-label">文件' + (i + 1) + '</span>' +
        '开始时间：<input type="time" class="scene-time-start" data-index="' + i + '" value="' + (f.start || '00:00') + '" />' +
        '结束时间：<input type="time" class="scene-time-end" data-index="' + i + '" value="' + (f.end || '23:59') + '" />' +
        '</div>';
    }).join('');
    container.querySelectorAll('.scene-time-start').forEach(function (input) {
      input.addEventListener('change', function () {
        var i = parseInt(input.getAttribute('data-index'), 10);
        if (sceneFileData[i]) sceneFileData[i].start = input.value;
      });
    });
    container.querySelectorAll('.scene-time-end').forEach(function (input) {
      input.addEventListener('change', function () {
        var i = parseInt(input.getAttribute('data-index'), 10);
        if (sceneFileData[i]) sceneFileData[i].end = input.value;
      });
    });
  }

  function syncSceneOrderBtns() {
    var container = getSceneOrderBtns();
    if (!container) return;
    container.innerHTML = sceneFileData.map(function (_, i) {
      return '<button type="button" class="btn btn-secondary btn-sm btn-order" data-index="' + i + '" title="下移">↓</button>';
    }).join('');
    container.querySelectorAll('.btn-order').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-index'), 10);
        if (i >= sceneFileData.length - 1) return;
        var t = sceneFileData[i];
        sceneFileData[i] = sceneFileData[i + 1];
        sceneFileData[i + 1] = t;
        rebuildSceneFileRowsFromData();
      });
    });
  }

  function rebuildSceneFileRowsFromData() {
    var container = getSceneFileRowsContainer();
    if (!container) return;
    container.innerHTML = '';
    sceneFileData.forEach(function (f, i) {
      appendFileRow(f.path, i);
    });
    syncSceneTimeRows();
    syncSceneOrderBtns();
  }

  function openSceneModalForEdit(idx) {
    var scene = sceneList[idx];
    if (!scene) return;
    editingSceneIndex = idx;
    document.getElementById('modal-create-scene-title').textContent = '编辑场景';
    document.getElementById('scene-name').value = scene.name;
    document.getElementById('scene-remark').value = scene.remark || '';
    document.getElementById('scene-loop').value = scene.loop ? '1' : '0';
    sceneFileData = (scene.files && scene.files.length)
      ? scene.files.map(function (f) {
          return { path: f.path || '', start: f.start || '00:00', end: f.end || '23:59' };
        })
      : [{ path: '', start: '00:00', end: '23:59' }];
    var container = getSceneFileRowsContainer();
    container.innerHTML = '';
    sceneFileData.forEach(function (f, i) {
      appendFileRow(f.path, i);
    });
    syncSceneTimeRows();
    syncSceneOrderBtns();
    openModal('modal-create-scene');
  }

  function openSceneModalForCreate() {
    editingSceneIndex = -1;
    document.getElementById('modal-create-scene-title').textContent = '创建新场景';
    sceneFileData = [];
    document.getElementById('scene-name').value = '';
    document.getElementById('scene-remark').value = '';
    document.getElementById('scene-loop').value = '1';
    var container = getSceneFileRowsContainer();
    container.innerHTML = '';
    addSceneFileRow('');
    openModal('modal-create-scene');
  }

  document.getElementById('btn-create-scene').addEventListener('click', openSceneModalForCreate);

  document.getElementById('btn-add-file-row').addEventListener('click', function () {
    addSceneFileRow('');
  });

  document.getElementById('btn-save-scene').addEventListener('click', function () {
    var name = document.getElementById('scene-name').value.trim();
    if (!name) {
      alert('请输入场景名称');
      return;
    }
    var remark = document.getElementById('scene-remark').value.trim();
    var loop = document.getElementById('scene-loop').value === '1';
    var fileList = sceneFileData.map(function (f, i) {
      var timeRow = getSceneTimeRows().querySelector('.time-row[data-index="' + i + '"]');
      var start = '00:00';
      var end = '23:59';
      if (timeRow) {
        var startInput = timeRow.querySelector('.scene-time-start');
        var endInput = timeRow.querySelector('.scene-time-end');
        if (startInput) start = startInput.value;
        if (endInput) end = endInput.value;
      }
      return { path: f.path || '', start: start, end: end };
    });
    var payload = { name: name, remark: remark, files: fileList, loop: loop };
    if (editingSceneIndex >= 0) {
      sceneList[editingSceneIndex] = payload;
      editingSceneIndex = -1;
      document.getElementById('modal-create-scene-title').textContent = '创建新场景';
    } else {
      sceneList.push(payload);
    }
    renderSceneTable();
    closeModal('modal-create-scene');
  });

  // 初始有一行文件
  (function () {
    var container = getSceneFileRowsContainer();
    if (container && container.querySelectorAll('.file-row').length === 0) {
      sceneFileData = [];
      addSceneFileRow('');
    }
  })();

  initRoute();
})();
