class NotificationManager:
    
    @staticmethod
    def send_time_change(users, event, old_time):
        for user in users:
            print(f"[Notification to {user}]: Event '{event.title}' time changed from {old_time} to {event.time}.")

    @staticmethod
    def send_address_change(users, event, old_address):
        for user in users:
            print(f"[Notification to {user}]: Address for '{event.title}' changed from {old_address} to {event.address}.")

    @staticmethod
    def send_general_tip(users, event, message):
        for user in users:
            print(f"[Heads-Up to {user}]: {message} (Event: {event.title})")

    @staticmethod
    def send_attendance_change(users, event, change_description):
        for user in users:
            print(f"[Notification to {user}]: Attendance update for '{event.title}': {change_description}")

    @staticmethod
    def send_requirements(users, event, message):
        for user in users:
            print(f"[Requirements for {user}]: {message} (Event: {event.title})")

    @staticmethod
    def send_reminders(users, event):
        for user in users:
            print(f"[Reminder to {user}]: Don't forget about '{event.title}' happening at {event.time}!")

    @staticmethod
    def send_welcome_message(user, event):
        print(f"[Welcome {user}]: You’ve been added to '{event.title}' hosted by {event.host}.")