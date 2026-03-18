document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    const resultsCount = document.getElementById('results-count');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const question = input.value.trim();
        if (!question) return;

        // Desabilita input e botão
        input.disabled = true;
        searchBtn.disabled = true;

        // Limpa resultados anteriores e mostra indicador
        resultsContent.innerHTML = '';
        resultsSection.classList.remove('hidden');
        const loadingId = showTypingIndicator();

        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question })
            });

            const data = await response.json();

            removeTypingIndicator(loadingId);

            if (data.error) {
                showResult('Erro', data.error, true);
            } else {
                const formattedAnswer = formatText(data.answer);
                showResult(question, formattedAnswer);
            }

        } catch (error) {
            removeTypingIndicator(loadingId);
            showResult('Erro', 'Ocorreu um erro ao conectar ao servidor. Tente novamente mais tarde.', true);
            console.error('Erro:', error);
        } finally {
            input.disabled = false;
            searchBtn.disabled = false;
            input.focus();
        }
    });

    function showResult(title, content, isError = false) {
        const div = document.createElement('div');
        div.className = isError ? 'result-item error-text' : 'result-item';
        
        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        
        const contentEl = document.createElement('p');
        if (isError) {
            contentEl.textContent = content;
        } else {
            contentEl.innerHTML = content;
        }
        
        div.appendChild(titleEl);
        div.appendChild(contentEl);
        resultsContent.appendChild(div);
        
        // Atualiza contador
        resultsCount.textContent = `Resultado para: "${input.value}"`;
    }

    function showTypingIndicator() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'typing-indicator';
        div.innerHTML = `
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <span style="margin-left: 8px;">Pesquisando...</span>
        `;
        resultsContent.appendChild(div);
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function formatText(text) {
        if (!text) return '';
        // Substituindo newlines por br
        let formatted = text.replace(/\n/g, '<br>');
        // Substitui backticks de codigo
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Negrito
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        return formatted;
    }
});
