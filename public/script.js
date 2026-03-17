document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('question-input');
    const history = document.getElementById('chat-history');
    const sendBtn = document.getElementById('send-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const question = input.value.trim();
        if (!question) return;

        // Adiciona mensagem do usuário
        addMessage(question, 'user-message');
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;

        // Mostra indicador de digitação
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
                addMessage(data.error, 'ai-message error-text');
            } else {
                // Para respostas Markdown básicas, faremos um parsing super simples
                // Numa aplicação real, usaríamos marked.js ou similar.
                const formattedAnswer = formatText(data.answer);
                addMessage(formattedAnswer, 'ai-message', true);
            }

        } catch (error) {
            removeTypingIndicator(loadingId);
            addMessage('Ocorreu um erro ao conectar ao servidor. Tente novamente mais tarde.', 'ai-message error-text');
            console.error('Erro:', error);
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    });

    function addMessage(text, className, isHtml = false) {
        const div = document.createElement('div');
        div.className = `message ${className}`;

        if (isHtml) {
            div.innerHTML = text;
        } else {
            div.textContent = text;
        }

        history.appendChild(div);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'message ai-message typing-indicator';
        div.innerHTML = `
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        `;
        history.appendChild(div);
        scrollToBottom();
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        history.scrollTop = history.scrollHeight;
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
