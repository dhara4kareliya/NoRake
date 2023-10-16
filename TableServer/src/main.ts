import { createServer, ServerOptions } from './server';

type MessageType = 'init' | 'destroy';

type Message = {
    type: MessageType,
    data: any,
};

console.log(`Starting table server. Waiting for init message.`);

const selfDestroyTimeout = setTimeout(() => {
    console.log(`Table server initialization timeout. Destroying now.`);
}, 5000);

process.on('message', (m: Message) => {
    if (m.type == 'init') {
        const opts = m.data as ServerOptions;

        console.log(`Got init message. Initializing table server:`, opts);

        createServer(opts)
        .then(({opts}) => {
            console.log(`Sending register message for table server:`, opts.id);

            process.send!({ type: 'register', data: { id: opts.id, server: { host: opts.host, port: opts.port } }});

            clearTimeout(selfDestroyTimeout);
        });
    }
    else if (m.type == 'destroy') {
        console.log(`Got destroy message. Destroying table server`);

        process.exit(0);
    }
})
