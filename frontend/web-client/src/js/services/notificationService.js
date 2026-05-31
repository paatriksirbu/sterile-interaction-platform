(function () {
  // CSS
  var style = document.createElement('style');
  style.textContent = [
    '#surgical-notifications {',
    '  position: fixed;',
    '  bottom: 24px;',
    '  right: 24px;',
    '  z-index: 100000;',
    '  display: flex;',
    '  flex-direction: column;',
    '  gap: 8px;',
    '  pointer-events: none;',
    '}',
    '.surgical-toast {',
    '  background: rgba(0,0,0,0.82);',
    '  color: #fff;',
    '  padding: 10px 16px;',
    '  border-radius: 8px;',
    '  font-size: 13px;',
    '  font-family: inherit;',
    '  border-left: 3px solid #00e5ff;',
    '  box-shadow: 0 0 12px rgba(0,229,255,0.25);',
    '  opacity: 0;',
    '  transform: translateX(20px);',
    '  animation: surgicalToastIn 0.25s ease forwards;',
    '  max-width: 300px;',
    '  word-break: break-word;',
    '}',
    '@keyframes surgicalToastIn {',
    '  to { opacity: 1; transform: translateX(0); }',
    '}',
    '.surgical-toast.fade-out {',
    '  animation: surgicalToastOut 0.3s ease forwards;',
    '}',
    '@keyframes surgicalToastOut {',
    '  to { opacity: 0; transform: translateX(20px); }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  var container = document.getElementById('surgical-notifications');
  if (!container) {
    container = document.createElement('div');
    container.id = 'surgical-notifications';
    document.body.appendChild(container);
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'surgical-toast';
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('fade-out');
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3700);
  }

  function connect() {
    var client = new StompJs.Client({
      webSocketFactory: function () {
        return new SockJS('http://localhost:8080/ws-notifications');
      },
      reconnectDelay: 5000,
      onConnect: function () {
        client.subscribe('/topic/notifications', function (frame) {
          var data = JSON.parse(frame.body);
          showToast(data.message || 'Notificación');
        });
      }
    });
    client.activate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
