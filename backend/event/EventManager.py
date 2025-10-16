class Event:
    def __init__(self, title, host, time, address, description, is_private=False):
        self.title = title
        self.host = host  # Typically a User object or host name
        self.time = time
        self.address = address
        self.description = description
        self.attendees = set()
        self.volunteers = set()
        self.is_private = is_private

    # View event details
    def view_details(self):
        details = {
            "Title": self.title,
            "Host": self.host,
            "Time": self.time,
            "Address": self.address,
            "Description": self.description,
            "Attendees": list(self.attendees),
            "Volunteers": list(self.volunteers),
            "Private Event": self.is_private
        }
        return details

    # Edit event details
    def change_address(self, new_address):
        self.address = new_address

    def change_time(self, new_time):
        self.time = new_time

    def change_description(self, new_description):
        self.description = new_description

    def change_title(self, new_title):
        self.title = new_title

    # Manage attendees
    def add_attendee(self, user):
        self.attendees.add(user)

    def remove_attendee(self, user):
        self.attendees.discard(user)

    # Manage volunteers
    def add_volunteer(self, user):
        self.volunteers.add(user)

    def remove_volunteer(self, user):
        self.volunteers.discard(user)

    # Privacy control
    def toggle_privacy(self):
        self.is_private = not self.is_private

    # Event deletion (just a stub here)
    def delete_event(self):
        print(f"Event '{self.title}' deleted.")
        return True
