export class Messaging {
    public static get(): string {
        return `
            function smartSyncCore(eb, nb) {
                // [2026-03-30] BUG-2 Fix - 移除手動補 expanded 的矛盾邏輯；展開狀態統一由 blockStates 管理
                // 只同步 className（不保留舊 expanded），block 展開狀態由上層 render() 的 blockStates 恢復邏輯負責
                if (eb.className !== nb.className) {
                    eb.className = nb.className;
                }
                if (eb.style.cssText !== nb.style.cssText) eb.style.cssText = nb.style.cssText;

                // [2026-03-30] UI Fix - 同步 Header 狀態 (正在思考中.../思考完畢 的背景色切換)
                var eHeader = eb.querySelector(':scope > .block-header');
                var nHeader = nb.querySelector(':scope > .block-header');
                if (eHeader && nHeader && eHeader.className !== nHeader.className) {
                    eHeader.className = nHeader.className;
                }

                // 2. 同步標題與圖示
                var eTitle = eb.querySelector('.block-title');
                var nTitle = nb.querySelector('.block-title');
                if (eTitle && nTitle && eTitle.textContent !== nTitle.textContent) {
                    eTitle.textContent = nTitle.textContent;
                }
                
                // [2026-03-25] UI Fix - 同步圖示內容，確保打勾/檔案/漏斗狀態能切換
                // [2026-03-30] Robustness - 即使 innerHTML 一樣，如果 class (如 spin) 變了也要更新
                var eIcon = eb.querySelector('.block-icon');
                var nIcon = nb.querySelector('.block-icon');
                if (eIcon && nIcon && (eIcon.innerHTML !== nIcon.innerHTML || eIcon.className !== nIcon.className)) {
                    eIcon.innerHTML = nIcon.innerHTML;
                    eIcon.className = nIcon.className;
                }

                // 3. 同步思考內容 (Leaf)
                var eThink = eb.querySelector('.thinking-text');
                var nThink = nb.querySelector('.thinking-text');
                if (eThink && nThink && eThink.innerHTML !== nThink.innerHTML) {
                    eThink.innerHTML = nThink.innerHTML;
                }

                // 4. 同步主要內容區 (Block Content)
                var eContent = eb.querySelector(':scope > .block-content');
                var nContent = nb.querySelector(':scope > .block-content');
                
                if (eContent && nContent) {
                    // [2026-03-30] Fix - .streaming 已改用 block-container 結構，移除重複 selector
                    var eSubBlocks = Array.from(eContent.querySelectorAll(':scope > .block-container, :scope > .initial-loader'));
                    var nSubBlocks = Array.from(nContent.querySelectorAll(':scope > .block-container, :scope > .initial-loader'));

                    // [2026-03-30] BUG-1 Fix - 遞迴同步後不再覆蓋 innerHTML，避免雙重同步毀掉展開狀態與 DOM 事件。
                    // 只有結構不符（data-type/data-subid 不同）或子塊數不等時，才 fallback 為整體覆蓋。
                    if (eSubBlocks.length === nSubBlocks.length && eSubBlocks.length > 0) {
                        var structureMatch = true;
                        for (var i = 0; i < eSubBlocks.length; i++) {
                            if (eSubBlocks[i].getAttribute('data-type') !== nSubBlocks[i].getAttribute('data-type') || 
                                eSubBlocks[i].getAttribute('data-subid') !== nSubBlocks[i].getAttribute('data-subid')) {
                                structureMatch = false; break;
                            }
                        }

                        if (structureMatch) {
                            // 結構比對成功：只遞迴同步子塊，不覆蓋整個 content
                            for (var i = 0; i < eSubBlocks.length; i++) {
                                smartSyncCore(eSubBlocks[i], nSubBlocks[i]);
                            }
                            // 同步 interleaved narrative text（子塊之間的純文字節點）
                            // 透過比對文字節點來決定是否需要更新，避免破壞子塊狀態
                            var eTextContent = eContent.innerText;
                            var nTextContent = nContent.innerText;
                            if (eTextContent !== nTextContent) {
                                // 只有文字內容有差異時，才對 content 整體更新（此時文字節點為主，子塊已同步過）
                                eContent.innerHTML = nContent.innerHTML;
                            }
                        } else {
                            // 結構不符：整體覆蓋為唯一安全選擇
                            eContent.innerHTML = nContent.innerHTML;
                        }
                    } else if (eContent.innerHTML !== nContent.innerHTML) {
                        eContent.innerHTML = nContent.innerHTML;
                    }
                }
                
                // [2026-03-30] Fix - streaming label 已改用 block-container 結構，此步驟已由 block-title/block-icon 同步覆蓋，無需單獨處理
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
