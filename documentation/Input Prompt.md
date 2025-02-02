A browser-based application which uses vite-react-ts-swc to provide a drag and drop interface for building a dashboard to control a smart home. It must be responsive to work on a desktop or mobile device.

It should use home-assistant-js-websocket to connect to a Home Assistant service to retrieve a list of available device entities.

Then, the user should be able to upload an image which represents a map of their house. This will then be rendered on the page in an svg image tag. The user can then select one of the home's entities, represented by a logically matching icon (a lightbulb for a light, for example), and drag it onto the map.

Tapping the icon should cause an appropriate Home Assistant service to be called, such as tapping on a light turning it off and on, or tapping on a speaker causing it to play or pause. A long press should pop up a dialog with more advanced options, such as a light having the option to change its color.

The system must allow for plugins to be added, as plain JS files, which will provide new components to support entities, new icon packs, and other functionality.

Once the map is set up, the data to recreate the map should be storable as JSON in local storage, and reloaded when the page is revisited.