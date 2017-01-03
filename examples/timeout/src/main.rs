extern crate tokio_timer;
extern crate futures;
extern crate futures_cpupool;

use tokio_timer::Timer;
use futures::Future;
use std::time::Duration;
use futures_cpupool::CpuPool;

const BIG_PRIME: u64 = 15485867;

// checks whether a number is prime, slowly
fn is_prime(num: u64) -> bool {
    for i in 2..num {
        if i % num == 0 { return false }
    }
    true
}

fn main1() {
    // set up a thread pool
    let pool = CpuPool::new_num_cpus();

    // spawn our computation, getting back a *future*
    let prime = pool.spawn_fn(|| {
        // For reasons we'll see later, we need to return a Result here
        let res: Result<bool, ()> = Ok(is_prime(BIG_PRIME));
        res
    });

    println!("Created the future");
}

fn main() {
    let pool = CpuPool::new(4);
    let timer = Timer::default();

    // a future that resolves to None after a timeout
    let timeout = timer.sleep(Duration::from_millis(700))
        .then(|_| Err(()));

    // a future that resolves to
    let prime = pool.spawn_fn(|| {
        Ok(is_prime(BIG_PRIME))
    });

    let winner = timeout.select(prime).map(|(win, _)| win);

    match winner.wait() {
        Ok(true) => println!("Prime"),
        Ok(false) => println!("Not prime"),
        Err(_) => println!("Timed out"),
    }
}
