export class Messaging {
    public static get(lang?: string): string {
        return `
            function syncAttributes(existing, newElem) {
                if (existing.nodeType !== 1 || newElem.nodeType !== 1) return;
                
                // 獲取目前的特殊狀態
                var hasBreathing = existing.classList.contains('breathing');
                
                // 同步 style.cssText
                if (existing.style.cssText !== newElem.style.cssText) {
                    existing.style.cssText = newElem.style.cssText;
                }

                // 同步所有 attributes (包括 class, data-*)
                var newAttrs = newElem.attributes;
                var oldAttrs = existing.attributes;

                // 移除不在新元素中的 attributes
                for (var i = oldAttrs.length - 1; i >= 0; i--) {
                    var attrName = oldAttrs[i].name;
                    if (!newElem.hasAttribute(attrName)) {
                        existing.removeAttribute(attrName);
                    }
                }

                // 新增或更新 attributes
                for (var i = 0; i < newAttrs.length; i++) {
                    var attr = newAttrs[i];
                    if (existing.getAttribute(attr.name) !== attr.value) {
                        existing.setAttribute(attr.name, attr.value);
                    }
                }

                // 強制恢復 breathing
                if (hasBreathing && !existing.classList.contains('breathing')) {
                    existing.classList.add('breathing');
                }
            }

            function smartSyncCore(eb, nb) {
                // 1. 同步本身屬性
                syncAttributes(eb, nb);

                // 2. 同步子節點
                var eNodes = eb.childNodes;
                var nNodes = nb.childNodes;

                if (eNodes.length === nNodes.length) {
                    for (var i = 0; i < eNodes.length; i++) {
                        var en = eNodes[i];
                        var nn = nNodes[i];
                        
                        if (en.nodeType === 3 && nn.nodeType === 3) {
                            // 文字節點同步
                            if (en.nodeValue !== nn.nodeValue) en.nodeValue = nn.nodeValue;
                        } else if (en.nodeType === 1 && nn.nodeType === 1 && en.tagName === nn.tagName) {
                            // 元素節點同步
                            if (en.classList.contains('block-icon')) {
                                // Optimized Icon Sync
                                var isSpinning = en.querySelector('.spin') || en.classList.contains('spin');
                                if (!isSpinning || en.innerHTML !== nn.innerHTML) {
                                    en.innerHTML = nn.innerHTML;
                                    syncAttributes(en, nn);
                                }
                            } else if (en.classList.contains('block-container')) {
                                // 遞迴同步區塊
                                smartSyncCore(en, nn);
                            } else if (en.classList.contains('block-content') || en.classList.contains('block-header')) {
                                // 關鍵佈局區塊也遞迴同步
                                smartSyncCore(en, nn);
                            } else {
                                // 一般小元素
                                syncAttributes(en, nn);
                                if (en.innerHTML !== nn.innerHTML) en.innerHTML = nn.innerHTML;
                            }
                        } else {
                            // 類型不符：單點替換
                            eb.replaceChild(nn.cloneNode(true), en);
                        }
                    }
                } else {
                    // 長度不符：整體覆蓋為最安全
                    if (eb.innerHTML !== nb.innerHTML) {
                        eb.innerHTML = nb.innerHTML;
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
                
                // 1. 清理已經不在列表中的 DOM 與快取
                var children = Array.from(c.children);
                children.forEach(function(child) {
                    var mid = child.getAttribute('data-id');
                    if (messageIds.indexOf(mid) === -1) {
                        c.removeChild(child);
                        if (typeof domCache !== 'undefined') domCache.delete(mid);
                        if (typeof htmlCache !== 'undefined') delete htmlCache[mid];
                    }
                });

                // 2. 局部與增量渲染
                messages.forEach(function(m, index) {
                    // [核心優化] [2026-03-30]：如果 HTML 沒變且不是正在流式輸出的最後一條訊息，直接跳過
                    var isLast = (index === messages.length - 1);
                    var isStreaming = m.isStreaming || m.isThinking || (isGenerating && isLast);
                    
                    if (typeof htmlCache !== 'undefined' && htmlCache[m.id] === m.html && typeof domCache !== 'undefined' && domCache.has(m.id)) {
                        // 如果是最後一條正在生成的訊息，不能完全跳過，因為呼吸動畫等狀態可能需要更新
                        if (!(isLast && isStreaming)) return;
                    }

                    var d = (typeof domCache !== 'undefined') ? domCache.get(m.id) : null;
                    if (!d) {
                        // 如果快取沒找到，嘗試從 DOM 找 (剛載入時)
                        d = document.querySelector('[data-id="' + m.id + '"]');
                        if (!d) {
                            d = document.createElement('div');
                            d.setAttribute('data-id', m.id);
                            d.className = m.role === 'system' ? 'system-msg' : 'message ' + m.role;
                            c.appendChild(d);
                        }
                        if (typeof domCache !== 'undefined') domCache.set(m.id, d);
                    }
                    
                    var tempWrapper = document.createElement('div');
                    tempWrapper.innerHTML = m.html;
                    
                    // 恢復區塊展開/摺疊狀態
                    tempWrapper.querySelectorAll('.block-container').forEach(function(block) {
                        var bType = block.getAttribute('data-type') || 'generic';
                        var bSubId = block.getAttribute('data-subid') || '';
                        var key = m.id + '_' + bType + '_' + bSubId;
                        
                        if (blockStates[key] === true) {
                            block.classList.add('expanded');
                        } else if (blockStates[key] === false) {
                            block.classList.remove('expanded');
                        }
                        // 預設展開新產生的報告
                        if (isGenerating && isLast && blockStates[key] === undefined) {
                            if (bType === 'report' || bType === 'generic') block.classList.add('expanded');
                        }
                    });

                    // 使用 smartSync 局部更新節點，避免閃爍
                    if (d.innerHTML === '') {
                        d.innerHTML = tempWrapper.innerHTML;
                    } else if (d.innerHTML !== tempWrapper.innerHTML) {
                        smartSync(d, tempWrapper);
                    }

                    // 更新快取
                    if (typeof htmlCache !== 'undefined') htmlCache[m.id] = m.html;

                    // 呼吸邊框與動畫狀態維護
                    var container = d.querySelector('.block-container');
                    if (container) {
                        if (m.isThinking || m.isStreaming) {
                            if (!container.classList.contains('breathing')) container.classList.add('breathing');
                        } else {
                            container.classList.remove('breathing');
                        }
                    }
                    
                    // [2026-03-30] INFO-1 Fix - 精確 selector，避免選到 action block 的 spinner
                    var thinkSpinner = d.querySelector('.block-think .block-icon .spin, .block-think .block-icon span.spin');
                    if (thinkSpinner) {
                        if (m.isThinking && !thinkSpinner.classList.contains('spin')) thinkSpinner.classList.add('spin');
                        else if (!m.isThinking) thinkSpinner.classList.remove('spin');
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

                // [Auto-Scroll] - Event-based scroll tracking (2026-03-30: Refined Snap-to-bottom)
                // 只要 isAutoScrollOn 為 true，就代表使用者目前在底部或剛送出訊息，應該維持在底部
                if (window.isAutoScrollOn) {
                    requestAnimationFrame(function() {
                        window.isProgScroll = true;
                        var scrollContainer = document.getElementById('container');
                        if (scrollContainer) {
                            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'auto' });
                        }
                        setTimeout(function() { window.isProgScroll = false; }, 100);
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
                window.isAutoScrollOn = true; 
                var mode = typeof chatMode !== 'undefined' ? chatMode : 'Single';
                if(!t && attachments.length === 0) return;
                vscode.postMessage({command:'send', text:t, attachments:attachments, chatMode:mode});
                i.value = ''; attachments = []; renderAtts(); i.style.height = 'auto';
            };
        `;
    }
}
