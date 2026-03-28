export class Messaging {
    public static get(): string {
        return `
            function smartSyncCore(eb, nb) {
                // 1. 同步屬性與類別 (修正過度保護導致動畫不停止的問題)
                var wasExpanded = eb.classList.contains('expanded');
                if (eb.className !== nb.className) {
                    eb.className = nb.className;
                    if (wasExpanded) eb.classList.add('expanded');
                    else eb.classList.remove('expanded');
                }
                if (eb.style.cssText !== nb.style.cssText) eb.style.cssText = nb.style.cssText;

                // 2. 同步標題與圖示
                var eTitle = eb.querySelector('.block-title');
                var nTitle = nb.querySelector('.block-title');
                if (eTitle && nTitle && eTitle.textContent !== nTitle.textContent) {
                    eTitle.textContent = nTitle.textContent;
                }
                
                // [2026-03-25] UI Fix - 同步圖示內容，確保打勾/檔案/漏斗狀態能切換
                var eIcon = eb.querySelector('.block-icon');
                var nIcon = nb.querySelector('.block-icon');
                if (eIcon && nIcon && eIcon.innerHTML !== nIcon.innerHTML) {
                    eIcon.innerHTML = nIcon.innerHTML;
                }

                // 3. 同步思考內容 (Leaf)
                var eThink = eb.querySelector('.thinking-text');
                var nThink = nb.querySelector('.thinking-text');
                if (eThink && nThink && eThink.textContent !== nThink.textContent) {
                    eThink.textContent = nThink.textContent;
                }

                // 4. 同步主要內容區 (Block Content)
                // 這是最難的部分：如果裡面有巢狀 Block，不能直接 innerHTML = ...
                var eContent = eb.querySelector(':scope > .block-content');
                var nContent = nb.querySelector(':scope > .block-content');
                
                if (eContent && nContent) {
                    var eSubBlocks = Array.from(eContent.querySelectorAll(':scope > .block-container, :scope > .streaming'));
                    var nSubBlocks = Array.from(nContent.querySelectorAll(':scope > .block-container, :scope > .streaming'));

                    if (eSubBlocks.length === nSubBlocks.length && eSubBlocks.length > 0) {
                        // 遞迴同步子區塊
                        for (var i = 0; i < eSubBlocks.length; i++) {
                            const esb = eSubBlocks[i];
                            const nsb = nSubBlocks[i];
                            
                            // 判斷是否為同類區塊
                            if ((esb.getAttribute('data-type') === nsb.getAttribute('data-type')) && 
                                esb.getAttribute('data-subid') === nsb.getAttribute('data-subid')) {
                                
                                smartSyncCore(esb, nsb);
                            } else {
                                // 結構變了，局部重繪該區塊
                                eContent.innerHTML = nContent.innerHTML;
                                break;
                            }
                        }
                    } else if (eContent.innerHTML !== nContent.innerHTML) {
                        // 沒有子區塊，或是數量不同，直接更新 innerHTML
                        eContent.innerHTML = nContent.innerHTML;
                    }
                }
                
                // 5. 同步串流標籤文字 (Streaming Label)
                if (eb.classList.contains('streaming')) {
                    var eStreamText = eb.querySelector('.streaming-text');
                    var nStreamText = nb.querySelector('.streaming-text');
                    if (eStreamText && nStreamText && eStreamText.innerHTML !== nStreamText.innerHTML) {
                        eStreamText.innerHTML = nStreamText.innerHTML;
                    }
                }
            }

            function smartSync(existingNode, newNode) {
                // 頂層同步，通常是 .message div
                // .message div 下面往往只有一個 .block-container
                var eb = existingNode.querySelector('.block-container');
                var nb = newNode.querySelector('.block-container');
                
                if (eb && nb) {
                    smartSyncCore(eb, nb);
                } else if (existingNode.innerHTML !== newNode.innerHTML) {
                    existingNode.innerHTML = newNode.innerHTML;
                }
            }

            function render() {
                var c = document.getElementById('container');
                if (!c) return;

                var messageIds = messages.map(function(m) { return m.id; });
                var children = Array.from(c.children);
                children.forEach(function(child) {
                    if (messageIds.indexOf(child.getAttribute('data-id')) === -1) {
                        c.removeChild(child);
                    }
                });

                messages.forEach(function(m) {
                    var d = c.querySelector('[data-id="' + m.id + '"]');
                    if (!d) {
                        d = document.createElement('div');
                        d.setAttribute('data-id', m.id);
                        d.className = m.role === 'system' ? 'system-msg' : 'message ' + m.role;
                        c.appendChild(d);
                    }
                    
                    var tempWrapper = document.createElement('div');
                    tempWrapper.innerHTML = m.html;
                    
                    // 恢復狀態
                    tempWrapper.querySelectorAll('.block-container').forEach(function(block) {
                        var bType = block.getAttribute('data-type') || 'generic';
                        var bSubId = block.getAttribute('data-subid') || '';
                        var key = m.id + '_' + bType + '_' + bSubId;
                        
                        if (blockStates[key] === true) {
                            block.classList.add('expanded');
                        } else if (blockStates[key] === false) {
                            block.classList.remove('expanded');
                        }
                        if (isGenerating && m.id === messages[messages.length-1].id && blockStates[key] === undefined) {
                            if (bType === 'report' || bType === 'generic') block.classList.add('expanded');
                        }
                    });

                    // [核心優化]：使用 smartSync 替代 innerHTML 直接覆蓋，避免動畫重置
                    if (d.innerHTML === '') {
                        d.innerHTML = tempWrapper.innerHTML;
                    } else if (d.innerHTML !== tempWrapper.innerHTML) {
                        smartSync(d, tempWrapper);
                    }

                    // 呼吸邊框與動畫狀態維護 (在 sync 之後，確保節點是原本的那一個)
                    var container = d.querySelector('.block-container');
                    if (container) {
                        if (m.isThinking || m.isStreaming) {
                            if (!container.classList.contains('breathing')) container.classList.add('breathing');
                        } else {
                            container.classList.remove('breathing');
                        }
                    }
                    
                    // 轉圈圈動畫維護
                    var spinner = d.querySelector('.spin');
                    if (spinner) {
                        // 如果有 spinner 且訊息仍在思考中，確保動畫類別存在
                        if (m.isThinking && !spinner.classList.contains('spin')) spinner.classList.add('spin');
                    }
                });


                var btnSend = document.getElementById('sendBtn');
                var btnStop = document.getElementById('stopBtn');
                if (btnSend && btnStop) {
                    if (isGenerating) {
                        btnSend.style.display = 'none';
                        btnStop.style.display = 'flex';
                    } else {
                        btnSend.style.display = 'flex';
                        btnStop.style.display = 'none';
                    }
                }
                
                // 動態標記正在流式傳輸的容器
                if (isGenerating) document.body.classList.add('is-streaming-active');
                else document.body.classList.remove('is-streaming-active');

                // [2026-03-28] [Auto-Scroll] - Event-based scroll tracking (As requested by User)
                if (window.isAutoScrollOn) {
                    // 等待下一 Frame 讓 DOM 完全長高後再進行到底的捲動
                    requestAnimationFrame(function() {
                        window.isProgScroll = true;
                        var scrollContainer = document.getElementById('container');
                        if (scrollContainer) scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'auto' });
                        // 設定較長的 Timeout 讓瀏覽器發出的 Scroll Event 抵達並被捕捉後，再解除鎖定
                        setTimeout(function() { window.isProgScroll = false; }, 150);
                    });
                }
            }

            function renderAtts() {
                var p = document.getElementById('attachmentsPreview');
                if (!p) return;
                p.innerHTML = '';
                attachments.forEach(function(a, i) {
                    var d = document.createElement('div');
                    if (a.type === 'image') {
                        d.className = 'attachment-preview';
                        d.innerHTML = '<img src="' + a.content + '" onclick="window.showFullImage(this.src)" style="cursor:zoom-in"><div class="remove-btn" onclick="event.stopPropagation(); window.removeAttachment(' + i + ')">✕</div>';
                    } else {
                        d.className = 'file-attachment';
                        d.innerHTML = '📄 ' + a.name + ' <span onclick="window.removeAttachment(' + i + ')" style="cursor:pointer; margin-left:4px; opacity:0.6">✕</span>';
                    }
                    p.appendChild(d);
                });
            }
            window.renderAtts = renderAtts;

            window.sendMessage = function() {
                var i = document.getElementById('input');
                var t = i.value.trim();
                var mode = typeof chatMode !== 'undefined' ? chatMode : 'Single';
                if(!t && attachments.length === 0) return;
                window.isAutoScrollOn = true; // 強制開啟自動往下捲動
                vscode.postMessage({command:'send', text:t, attachments:attachments, chatMode:mode});
                i.value = ''; attachments = []; renderAtts(); i.style.height = 'auto';
            };
        `;
    }
}
