const lockers = {};
class Locker {
    constructor() {
        this.queue = []; // queue to maintain callbacks for each client
        this.isLocked = false; // status of the locker
        this.setTimeoutId = undefined;
    }

    lock(callback) {
        this.queue.push(callback); // pushing the client callback into queue
        // if the resource is not locked then proceed
        if (!this.isLocked) {
            this.proceed();
        }
    }

    proceed() {
        // if the queue is empty then no need to proceed
        if (this.queue.length === 0) {
            this.isLocked = false;
            return;
        }

        // get the next client callback from the queue
        const callback = this.queue.shift();
        this.isLocked = true;

        this.setTimeoutId = setTimeout(() => {
            console.log("queue timeout");
            this.unlock();
        }, 60 * 1000);
        callback(() => {
            // once the client is done, unlock the resource for the next client
            this.unlock();
        });
    }

    unlock() {
        if (this.setTimeoutId !== undefined)
            clearTimeout(this.setTimeoutId);

        this.isLocked = false; // unlock the resource
        this.proceed(); // proceed to the next client in the queue
    }
}


module.exports = {
    lock: async(locker_id) => {
        if (!lockers.hasOwnProperty(locker_id)) {
            console.log(`New Locker requset: ID: ${locker_id}`)
            lockers[locker_id] = new Locker(); // Create a new locker instance for the key if it doesn't exist
        }
        const locker = lockers[locker_id]; // Retrieve the locker instance from the hash table
        return await new Promise(function(resolve, reject) {
            locker.lock((unlock) => {
                resolve(true);
            });
        });

    },
    unlock: (locker_id) => {
        if (lockers.hasOwnProperty(locker_id)) {
            const locker = lockers[locker_id]; // Retrieve the locker instance from the hash table
            locker.unlock();
            console.log(`[Unlock] Request Locker ID: ${locker_id}`);
            return true;
        } else {
            return false;
        }
    }

};